import React, { useEffect } from 'react';
import { Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { GlassProvider } from '@rbayuokt/expo-adaptive-glass';
import { GlassNavigationTabBar, GlassScreenBackdrop } from '@rbayuokt/expo-adaptive-glass/navigation';

import HomeScreen from './screens/HomeScreen';
import TournamentsScreen from './screens/TournamentsScreen';
import TeamsScreen from './screens/TeamsScreen';
import HistoryScreen from './screens/HistoryScreen';
import ScoringScreen from './screens/ScoringScreen';
import ScorecardScreen from './screens/ScorecardScreen';
import MatchResultScreen from './screens/MatchResultScreen';
import { APP_FONT_FAMILY } from './constants/colors';
import { ThemeProvider, useTheme } from './constants/theme';
import { initDatabase } from './database/db';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function TabNavigator() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  return (
    <Tab.Navigator
      screenLayout={({ children }) => <GlassScreenBackdrop>{children}</GlassScreenBackdrop>}
      tabBar={(props) => (
        <GlassNavigationTabBar
          {...props}
          tint="light"
          intensity={0.85}
          lens={true}
          selection="pill"
          selectionColor="rgba(0, 180, 138, 0.16)"
          style={{
            bottom: Math.max(insets.bottom, 8) + 8,
            left: 36,
            right: 36,
            borderRadius: 999,
            boxShadow: '0px 8px 22px rgba(16, 32, 48, 0.18)',
          }}
        />
      )}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: theme.tabActive,
        tabBarInactiveTintColor: theme.tabInactive,
        tabBarLabel: ({ color, children }) => (
          <Text
            numberOfLines={1}
            style={{
              fontFamily: APP_FONT_FAMILY,
              fontSize: 11,
              fontWeight: '700',
              color,
              marginTop: 1,
            }}
          >
            {children}
          </Text>
        ),
        tabBarIcon: ({ color, focused }) => {
          let iconName: keyof typeof MaterialCommunityIcons.glyphMap = 'circle';

          if (route.name === 'Home') iconName = 'cricket';
          else if (route.name === 'Tournaments') iconName = 'trophy-outline';
          else if (route.name === 'Teams') iconName = 'account-group-outline';
          else if (route.name === 'History') iconName = 'history';

          if (focused) {
            if (route.name === 'Tournaments') iconName = 'trophy';
            else if (route.name === 'Teams') iconName = 'account-group';
          }

          return <MaterialCommunityIcons name={iconName} size={22} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'New Match' }} />
      <Tab.Screen name="Tournaments" component={TournamentsScreen} options={{ title: 'Tournaments' }} />
      <Tab.Screen name="Teams" component={TeamsScreen} options={{ title: 'Teams' }} />
      <Tab.Screen name="History" component={HistoryScreen} options={{ title: 'History' }} />
    </Tab.Navigator>
  );
}

function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Tabs" component={TabNavigator} />
        <Stack.Screen name="Scoring" component={ScoringScreen} />
        <Stack.Screen name="Scorecard" component={ScorecardScreen} />
        <Stack.Screen name="MatchResult" component={MatchResultScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  useEffect(() => {
    initDatabase();
  }, []);

  return (
    <SafeAreaProvider>
      <GlassProvider quality="auto" clarity={0.85}>
        <ThemeProvider>
          <RootNavigator />
        </ThemeProvider>
      </GlassProvider>
    </SafeAreaProvider>
  );
}
