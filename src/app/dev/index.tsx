import { router, type Href } from 'expo-router';

import { Card, Header, ListRow, ScreenContainer } from '@/components/ui';
import { routes } from '@/constants/routes';

const TOOLS: { label: string; href: Href }[] = [
  { label: 'Database (demo data, template scenario, reset)', href: '/dev/db' },
  { label: 'Components', href: '/dev/components' },
  { label: 'Theme', href: '/dev/theme' },
  { label: 'Brand', href: '/dev/brand' },
  { label: 'Execution engine', href: '/dev/execution' },
  { label: 'Welcome screen', href: routes.welcome },
];

/** Developer tools hub (dev builds only; reached from Settings, no longer on Home). */
export default function DevHome() {
  return (
    <ScreenContainer edges={['top', 'bottom']}>
      <Header title="Developer tools" onBack={() => router.back()} large={false} />
      <Card>
        {TOOLS.map((tool) => (
          <ListRow key={tool.label} title={tool.label} onPress={() => router.push(tool.href)} />
        ))}
      </Card>
    </ScreenContainer>
  );
}
