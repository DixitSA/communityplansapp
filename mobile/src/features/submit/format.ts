import type { SubmissionStatus } from '@/lib/api';

/** What the person sees for a suggestion's status. "Rejected" is softened on purpose. */
export function submissionStatusLabel(status: SubmissionStatus): string {
  switch (status) {
    case 'approved':
      return 'Added';
    case 'rejected':
      return 'Not added';
    default:
      return 'Pending';
  }
}
