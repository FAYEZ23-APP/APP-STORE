import React, { useState } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';

const getInitials = (name) => {
  if (!name || typeof name !== 'string') return 'EM';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};

export default function ProfileAvatar({
  name = '',
  imageUrl = null,
  size = 56,
  role = 'Buyer',
}) {
  const [imageError, setImageError] = useState(false);
  const initials = getInitials(name);
  const fontSize = Math.round(size * 0.38);

  const isSeller = role === 'Seller';
  const ringColor = isSeller ? colors.gold : colors.primary;

  return (
    <View style={[styles.outerContainer, { width: size + 4, height: size + 4, borderRadius: (size + 4) / 2 }]}>
      <View
        style={[
          styles.ring,
          {
            width: size + 2,
            height: size + 2,
            borderRadius: (size + 2) / 2,
            borderColor: ringColor,
          },
        ]}
      >
        {imageUrl && !imageError ? (
          <Image
            source={{ uri: imageUrl }}
            style={{ width: size, height: size, borderRadius: size / 2 }}
            onError={() => setImageError(true)}
            resizeMode="cover"
          />
        ) : (
          <View
            style={[
              styles.fallbackCircle,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
                backgroundColor: '#2A303A',
              },
            ]}
          >
            <Text style={[styles.initialsText, { fontSize }]}>{initials}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  ring: {
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1F2329',
  },
  fallbackCircle: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  initialsText: {
    color: colors.white,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
