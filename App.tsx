import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import HomeScreen from './screens/HomeScreen';
import TournamentsScreen from './screens/TournamentsScreen';
import TeamsScreen from './screens/TeamsScreen';
import HistoryScreen from './screens/HistoryScreen';
import ScoringScreen from './screens/ScoringScreen';
import MatchResultScreen from './screens/MatchResultScreen';
import { COLORS } from './constants/colors';
import { initDatabase } from './database/db';

import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassProvider } from '@rbayuokt/expo-adaptive-glass';
import { GlassNavigationTabBar, GlassScreenBackdrop } from '@rbayuokt/expo-adaptive-glass/navigation';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function TabNavigator() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenLayout={({ children }) => <GlassScreenBackdrop>{children}</GlassScreenBackdrop>}
      tabBar={(props) => (
        <GlassNavigationTabBar
          {...props}
          tint="dark"
          intensity={70}
          lens={true}
          style={{
            position: 'absolute',
            bottom: Math.max(insets.bottom + 10, 30), // dynamic safe area with minimum spacing
            left: '15%',
            right: '15%', // 30% total margin ensures exactly 70% width for a tighter floating dock
            borderRadius: 40,
            height: 75, // Increases vertical padding/spaciousness
            // overflow: 'hidden' intentionally removed to prevent the native lens from clipping during press/drag expansions
          }}
        />
      )}
      screenOptions={({ route }) => ({
        headerShown: false, // Hide default headers for cleaner look, we'll use local headers or none
        tabBarShowLabel: false, // Hide labels
        tabBarActiveTintColor: '#0F8FAC', // White
        tabBarInactiveTintColor: '#FFFFFF',

        tabBarIcon: ({ color, size, focused }) => {
          let iconName: keyof typeof MaterialCommunityIcons.glyphMap = 'circle';

          if (route.name === 'Home') iconName = 'cricket';
          else if (route.name === 'Tournaments') iconName = 'trophy';
          else if (route.name === 'Teams') iconName = 'account-group';
          else if (route.name === 'History') iconName = 'history';

          return (
            <View style={{
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <MaterialCommunityIcons name={iconName} size={26} color={color} />
            </View>
          );
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

export default function App() {
  useEffect(() => {
    initDatabase();
  }, []);

  return (
    <SafeAreaProvider>
      <GlassProvider>
        <NavigationContainer>
        {/* @ts-ignore: expo-status-bar types in this version don't map backgroundColor perfectly */}
        <StatusBar style="light" backgroundColor={COLORS.primary} />
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Tabs" component={TabNavigator} />
          <Stack.Screen
            name="Scoring"
            component={ScoringScreen}
            options={{
              headerShown: true,
              headerStyle: { backgroundColor: COLORS.primary },
              headerTintColor: COLORS.surface,
              title: 'Scoring',
            }}
          />
          <Stack.Screen
            name="MatchResult"
            component={MatchResultScreen}
            options={{ headerShown: false }}
          />
        </Stack.Navigator>
      </NavigationContainer>
      </GlassProvider>
    </SafeAreaProvider>
  );
}
