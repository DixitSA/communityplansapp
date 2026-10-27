import { Tabs } from 'expo-router';

import { Icon, useTheme } from '@/design';

// Web-only fallback (NativeTabs is iOS/Android). Used for browser screenshots.
export default function TabsLayoutWeb() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.inkSecondary,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.line },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Feed', tabBarIcon: ({ color }) => <Icon name="house.fill" tintColor={color} /> }}
      />
      <Tabs.Screen
        name="chats"
        options={{
          title: 'Chats',
          tabBarIcon: ({ color }) => <Icon name="bubble.left.and.bubble.right" tintColor={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <Icon name="person.crop.circle" tintColor={color} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ color }) => <Icon name="magnifyingglass" tintColor={color} />,
        }}
      />
    </Tabs>
  );
}
