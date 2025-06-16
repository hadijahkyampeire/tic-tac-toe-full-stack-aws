import { signUp, signIn, signOut, confirmSignUp, fetchAuthSession } from 'aws-amplify/auth';

export const register = async (email: string, password: string) => {
  return signUp({
    username: email,
    password,
    options: { userAttributes: { email }}
  });
};

export const login = async (email: string, password: string) => {
  return signIn({ username: email, password });
};

export const logOut = async () => {
  return signOut();
};

export const confirmRegister = async (email: string, code: string) => {
  return confirmSignUp({ username: email, confirmationCode: code });
};

export const fetchSession = async () => {
  return fetchAuthSession();
}
