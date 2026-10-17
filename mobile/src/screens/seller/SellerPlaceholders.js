import tw from 'twrnc';
import React, { useContext } from 'react';
import { View, Text, Button } from 'react-native';
import { AuthContext } from '../../context/AuthContext';

const PlaceholderScreen = ({ title }) => {
  const { logout } = useContext(AuthContext);
  return (
    <View style={tw`flex-1 justify-center items-center`}>
      <Text style={tw`text-xl mb-4`}>{title}</Text>
      <Button title="Logout" onPress={logout} />
    </View>
  );
};

export const DashboardScreen = () => <PlaceholderScreen title="Seller Dashboard" />;
export const MyProductsScreen = () => <PlaceholderScreen title="Seller Products" />;
export const SellerOrdersScreen = () => <PlaceholderScreen title="Seller Orders" />;
