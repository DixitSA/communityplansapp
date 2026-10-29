import { useEffect, useState } from 'react';
import { Keyboard } from 'react-native';

/** True while the on-screen keyboard is up. The composer drops its home-indicator padding then, because the keyboard already covers it. */
export function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardWillShow', () => setVisible(true));
    const showDid = Keyboard.addListener('keyboardDidShow', () => setVisible(true));
    const hide = Keyboard.addListener('keyboardWillHide', () => setVisible(false));
    const hideDid = Keyboard.addListener('keyboardDidHide', () => setVisible(false));
    return () => {
      show.remove();
      showDid.remove();
      hide.remove();
      hideDid.remove();
    };
  }, []);
  return visible;
}
