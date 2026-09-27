import { router } from 'expo-router';
import Tabs from 'expo-router/js-tabs';

import { executionRoute } from '@/components/execution/useStartWorkout';
import { useStartFabSync } from '@/components/start/useStartState';
import { TabBar } from '@/components/ui';
import { useExecutionStore } from '@/store/executionStore';

export default function TabsLayout() {
  useStartFabSync();
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="home" />
      <Tabs.Screen name="train" />
      <Tabs.Screen
        name="start"
        listeners={{
          // With a workout in progress, Start means "Continue" (step 18).
          tabPress: (e) => {
            const active = useExecutionStore.getState().state;
            if (!active) return;
            e.preventDefault();
            router.push(executionRoute(active));
          },
        }}
      />
      <Tabs.Screen name="progress" />
      <Tabs.Screen name="plan" />
    </Tabs>
  );
}
