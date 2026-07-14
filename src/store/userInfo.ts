import { makeAutoObservable } from 'mobx';

export type UserInfoData = {
  id?: string | number;
  name?: string;
  avatar?: string;
} | null;

class UserInfoStore {
  info: UserInfoData = null;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  setInfo(info: UserInfoData) {
    this.info = info;
  }

  clear() {
    this.info = null;
  }

  get isLogin() {
    return !!this.info?.id;
  }
}

const userInfo = new UserInfoStore();

export default userInfo;
