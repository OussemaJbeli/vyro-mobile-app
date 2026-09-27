import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Avatar, Button } from '@/components/ui';
import { useAvatar } from '@/hooks/useAvatar';
import { makeStyles } from '@/theme';

/** Profile picture: tap the avatar or "Choose photo"; stays private on the device. */
export function AvatarEditor({ name }: { name: string | null }) {
  const { t } = useTranslation('settings');
  const styles = useStyles();
  const avatar = useAvatar();
  return (
    <View style={styles.wrap}>
      <Avatar
        name={name}
        uri={avatar.uri}
        fallbackSource={avatar.fallback}
        size={96}
        onPress={() => void avatar.pick()}
        accessibilityLabel={t('profile.photo')}
      />
      <View style={styles.row}>
        <Button
          size="sm"
          variant="secondary"
          icon="photo"
          label={t('profile.photo')}
          onPress={() => void avatar.pick()}
          testID="avatar-pick"
        />
        {avatar.uri ? (
          <Button
            size="sm"
            variant="ghost"
            label={t('profile.photoRemove')}
            onPress={() => void avatar.remove()}
          />
        ) : null}
      </View>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  wrap: { alignItems: 'center', gap: t.spacing.md, paddingVertical: t.spacing.md },
  row: { flexDirection: 'row', gap: t.spacing.sm },
}));
