import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { type Repositories } from '@/db/repositories';
import { toast } from '@/store/uiStore';
import { toUserMessage } from '@/utils/errors';

import { useRepositories } from './RepositoriesProvider';

type Keys = readonly (readonly string[])[];

/**
 * Mutation wrapper: runs a repository call, invalidates the declared query roots,
 * and shows a human error toast on failure (FS §57). Existing data is never touched
 * on failure because repositories write in transactions.
 */
export function useRepoMutation<V, R>(
  mutationFn: (repos: Repositories, vars: V) => Promise<R>,
  opts: { invalidate: Keys; successMessage?: string; onSuccess?: (result: R, vars: V) => void },
) {
  const repos = useRepositories();
  const client = useQueryClient();
  const { t } = useTranslation('errors');
  return useMutation({
    mutationFn: (vars: V) => mutationFn(repos, vars),
    onSuccess: async (result, vars) => {
      await Promise.all(
        opts.invalidate.map((key) => client.invalidateQueries({ queryKey: [...key] })),
      );
      if (opts.successMessage) toast.success(opts.successMessage);
      opts.onSuccess?.(result, vars);
    },
    onError: (error) => {
      toast.error(toUserMessage(error, (k) => t(k as 'UNKNOWN')));
    },
  });
}
