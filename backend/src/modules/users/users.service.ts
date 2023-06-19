import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'entities/user.entity';
import { PostGresErrorCode } from 'helpers/postgresErrorCode.enum';
import Logging from 'library/Logging';
import { AbstractService } from 'modules/common/abstract.service';
import { Repository } from 'typeorm';
import { compareHash, hash } from 'utils/bcrypt';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user-dto';

@Injectable()
export class UsersService extends AbstractService {
  constructor(
    @InjectRepository(User) private readonly usersRepository: Repository<User>,
  ) {
    super(usersRepository);
  }

  async create(createUserDto: CreateUserDto): Promise<User> {
    const user = await this.findBy({ email: createUserDto.email });
    if (user)
      throw new BadRequestException('User with that email already exists');

    try {
      const newUser = this.usersRepository.create({ ...createUserDto });
      return this.usersRepository.save(newUser);
    } catch (error) {
      Logging.error(error);
      throw new BadRequestException(
        'Something went wrong while creating a new user',
      );
    }
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = (await this.findById(id)) as User;
    const { email, password, confirm_password, ...data } = updateUserDto;
    if (user.email !== email && email) user.email = email;

    if (password && confirm_password) {
      if (password !== confirm_password)
        throw new BadRequestException('Passwords do not match');
      if (await compareHash(password, user.password)) {
        throw new BadRequestException(
          'New password can not be the same as your old',
        );
      }
      user.password = await hash(password);
    }

    try {
      Object.entries(data).map((entry) => {
        user[entry[0]] = entry[1];
      });

      return this.usersRepository.save(user);
    } catch (error) {
      Logging.error(error);
      if (error?.code === PostGresErrorCode.UniqueViolation) {
        throw new BadRequestException('User with that email already exists');
      }
      throw new InternalServerErrorException(
        'Something went wrong while updating user',
      );
    }
  }

  async updateUserImageId(id: string, avatar: string): Promise<User> {
    const user = await this.findById(id);
    return this.update(user.id, { avatar });
  }
}
