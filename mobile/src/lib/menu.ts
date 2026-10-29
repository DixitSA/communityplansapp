import { ActionSheetIOS, Alert } from 'react-native';

export type MenuOption = { label: string; destructive?: boolean; run?: () => void };

/** A native action sheet on iOS, an alert elsewhere. The last option is always Cancel. */
export function showMenu(title: string | undefined, options: MenuOption[]): void {
  if (process.env.EXPO_OS === 'ios') {
    const labels = [...options.map((o) => o.label), 'Cancel'];
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title,
        options: labels,
        cancelButtonIndex: labels.length - 1,
        destructiveButtonIndex: options.flatMap((o, i) => (o.destructive ? [i] : [])),
      },
      (index) => options[index]?.run?.(),
    );
    return;
  }
  Alert.alert(title ?? '', undefined, [
    ...options.map((o) => ({
      text: o.label,
      style: o.destructive ? ('destructive' as const) : ('default' as const),
      onPress: o.run,
    })),
    { text: 'Cancel', style: 'cancel' as const },
  ]);
}
