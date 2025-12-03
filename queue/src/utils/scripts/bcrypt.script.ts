import * as bcrypt from 'bcryptjs';

export class Bcrypt {
  hashPassword = async (property: string): Promise<any> => {
    return await bcrypt.hash(property, 10);
  };

  comparePasswrod = async (
    reqProperty: string,
    resPoperty: string,
  ): Promise<boolean> => {
    return await bcrypt.compare(reqProperty, resPoperty);
  };
}
