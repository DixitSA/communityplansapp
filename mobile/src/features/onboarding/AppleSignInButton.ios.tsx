import * as AppleAuthentication from 'expo-apple-authentication';

import { useTheme } from '@/design';

import type { AppleSignInButtonProps } from './AppleSignInButton';

/** Apple's own button (required look and wording). White on dark canvas, black on light. */
export function AppleSignInButton({ onPress, disabled = false }: AppleSignInButtonProps) {
  const { scheme } = useTheme();
  return (
    <AppleAuthentication.AppleAuthenticationButton
      buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
      buttonStyle={
        scheme === 'dark'
          ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
          : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
      }
      cornerRadius={26}
      onPress={onPress}
      style={{ width: '100%', height: 52, opacity: disabled ? 0.5 : 1 }}
    />
  );
}
