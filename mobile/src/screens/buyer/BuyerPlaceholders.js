import tw from 'twrnc';
import React, { useContext } from 'react';
import { View, Text, Button } from 'react-native';
import { AuthContext } from '../../context/AuthContext';

const PlaceholderScreen = ({ title }) => {
  return (
    <View style={tw`flex-1 justify-center items-center`}>
      <Text style={tw`text-xl mb-4`}>{title}</Text>
    </View>
  );
};

export const CatalogScreen = () => <PlaceholderScreen title="Buyer Catalog" />;
export const CartScreen = () => <PlaceholderScreen title="Buyer Cart" />;
export const MyOrdersScreen = () => <PlaceholderScreen title="Buyer Orders" />;
