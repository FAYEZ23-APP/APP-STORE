import React, { useRef, useState } from 'react';
import { View, TextInput, StyleSheet, Platform } from 'react-native';
import { colors } from '../theme/colors';

/**
 * OtpInput - Modern, accessible 6-digit OTP Input for Egypt Shop Mobile
 * 100% Synchronized with Web OtpInput.jsx
 */
const OtpInput = ({ length = 6, value = '', onChange, onComplete, disabled = false }) => {
  const inputRefs = useRef([]);
  const [focusedIndex, setFocusedIndex] = useState(null);

  const digits = Array.from({ length }, (_, i) => value[i] || '');

  const handleChangeText = (text, index) => {
    if (disabled) return;

    // Handle full paste (e.g., 6 digits pasted at once)
    const cleaned = text.replace(/\D/g, '');
    if (cleaned.length > 1) {
      const newDigits = cleaned.slice(0, length);
      onChange?.(newDigits);
      if (newDigits.length === length) {
        onComplete?.(newDigits);
        inputRefs.current[length - 1]?.focus();
      } else {
        inputRefs.current[Math.min(newDigits.length, length - 1)]?.focus();
      }
      return;
    }

    // Single digit input
    const char = cleaned.slice(-1) || '';
    const currentArray = Array.from({ length }, (_, i) => value[i] || '');
    currentArray[index] = char;
    const nextValue = currentArray.join('').trimEnd();
    onChange?.(nextValue);

    if (char && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    if (currentArray.every((d) => d !== '') && nextValue.length === length) {
      onComplete?.(nextValue);
    }
  };

  const handleKeyPress = (e, index) => {
    if (disabled) return;
    if (e.nativeEvent.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        const currentArray = Array.from({ length }, (_, i) => value[i] || '');
        currentArray[index - 1] = '';
        onChange?.(currentArray.join('').trimEnd());
        inputRefs.current[index - 1]?.focus();
      }
    }
  };

  return (
    <View style={styles.container}>
      {Array.from({ length }).map((_, index) => {
        const isFilled = Boolean(digits[index]);
        const isFocused = focusedIndex === index;

        return (
          <TextInput accessibilityLabel="Input" accessible={true}
            key={index}
            ref={(ref) => {
              inputRefs.current[index] = ref;
            }}
            style={[
              styles.box,
              isFilled && styles.boxFilled,
              isFocused && styles.boxFocused,
              disabled && styles.boxDisabled,
            ]}
            keyboardType="number-pad"
            maxLength={index === 0 ? length : 1}
            value={digits[index]}
            onChangeText={(text) => handleChangeText(text, index)}
            onKeyPress={(e) => handleKeyPress(e, index)}
            onFocus={() => setFocusedIndex(index)}
            onBlur={() => setFocusedIndex(null)}
            selectTextOnFocus
            editable={!disabled}
            textAlign="center"
            autoCapitalize="none"
            autoCorrect={false}
            textContentType={index === 0 ? 'oneTimeCode' : 'none'}
            autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
          />
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginVertical: 16,
    // Ensure LTR layout so digits read 1..6 left-to-right even in RTL
    direction: 'ltr',
  },
  box: {
    width: 48,
    height: 58,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.screenBg,
    fontSize: 22,
    fontWeight: '900',
    color: colors.textPrimary,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  boxFilled: {
    borderColor: colors.primaryBorder,
    backgroundColor: colors.primarySoft,
    color: colors.primary,
  },
  boxFocused: {
    borderColor: colors.primary,
    borderWidth: 2,
    backgroundColor: colors.white,
    color: colors.primary,
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
      default: {},
    }),
  },
  boxDisabled: {
    backgroundColor: colors.disabledBg,
    borderColor: colors.border,
    color: colors.disabledText,
    opacity: 0.6,
  },
});

export default OtpInput;
