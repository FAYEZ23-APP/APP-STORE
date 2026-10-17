import * as SecureStore from 'expo-secure-store';

export const setToken = async (token) => {
  try {
    await SecureStore.setItemAsync('jwt_token', token);
  } catch (error) {
    console.error('Error saving token', error);
  }
};

export const getToken = async () => {
  try {
    return await SecureStore.getItemAsync('jwt_token');
  } catch (error) {
    console.error('Error getting token', error);
    return null;
  }
};

export const removeToken = async () => {
  try {
    await SecureStore.deleteItemAsync('jwt_token');
  } catch (error) {
    console.error('Error removing token', error);
  }
};
