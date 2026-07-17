import { Button, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions } from '@mui/material';

interface Props {
  open: boolean;
  /** Submission name, shown in the confirmation text. */
  name: string;
  /** Extra clause about what survives the delete (e.g. the generated benchmark). */
  note?: string;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/** Two-step confirmation for deleting a finished submission. */
export default function DeleteSubmissionDialog({ open, name, note, deleting, onCancel, onConfirm }: Props) {
  return (
    <Dialog open={open} onClose={() => !deleting && onCancel()}>
      <DialogTitle>Delete this submission?</DialogTitle>
      <DialogContent>
        <DialogContentText>
          This permanently deletes <strong>{name}</strong> and all of its steps, logs, and
          results.{note ? ` ${note}` : ''} This cannot be undone.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={deleting}>Cancel</Button>
        <Button onClick={onConfirm} color="error" variant="contained" disabled={deleting}>
          {deleting ? 'Deleting…' : 'Delete'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
