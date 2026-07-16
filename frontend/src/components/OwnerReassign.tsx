import { Fragment, useEffect, useState } from 'react';
import { Autocomplete, TextField, Button, Box, CircularProgress, Typography } from '@mui/material';
import { usersApi, tasksApi } from '../api';
import type { User } from '../api';
import OwnerLabel from './OwnerLabel';

interface Props {
  taskId: number;
  currentName?: string | null;
  currentEmail?: string | null;
  /** Refetch the submission so the displayed owner updates. */
  onChanged: () => void;
}

const label = (u: User) => (u.name ? `${u.name} (${u.email})` : u.email);

/** Admin-only control to reassign a submission to another enabled account, shown
 *  inside the details accordion. Picks the target from a searchable list. */
export default function OwnerReassign({ taskId, currentName, currentEmail, onChanged }: Props) {
  const [users, setUsers] = useState<User[]>([]);
  const [selected, setSelected] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    usersApi.list()
      // Only enabled accounts are valid submission owners.
      .then((list) => { if (alive) setUsers(list.filter((u) => u.enabled).sort((a, b) => label(a).localeCompare(label(b), undefined, { sensitivity: 'base' }))); })
      .catch(() => { if (alive) setError('Failed to load users'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const handle = async () => {
    if (!selected) return;
    setSaving(true); setError(null);
    try { await tasksApi.changeOwner(taskId, selected.id); setSelected(null); onChanged(); }
    catch (e: any) { setError(e?.response?.data?.error || 'Reassignment failed'); }
    finally { setSaving(false); }
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
      <Box sx={{ typography: 'body2' }}><OwnerLabel stacked name={currentName} email={currentEmail} /></Box>
      <Autocomplete size="small" options={users} loading={loading} getOptionLabel={label}
        value={selected} onChange={(_e, v) => setSelected(v)} sx={{ minWidth: 240 }}
        isOptionEqualToValue={(o, v) => o.id === v.id}
        renderOption={(props, option) => {
          const { key, ...rest } = props as { key?: string } & Record<string, unknown>;
          return <li key={key} {...rest}><OwnerLabel stacked name={option.name} email={option.email} /></li>;
        }}
        renderInput={(params) => (
          <TextField {...params} label={loading ? 'Loading users…' : 'Reassign to…'}
            InputProps={{ ...params.InputProps, endAdornment: (<Fragment>{loading ? <CircularProgress color="inherit" size={18} /> : null}{params.InputProps.endAdornment}</Fragment>) }} />
        )} />
      <Button variant="outlined" size="small" disabled={!selected || saving || selected.email === currentEmail} onClick={handle}>
        {saving ? 'Reassigning…' : 'Reassign'}
      </Button>
      {error && <Typography variant="body2" color="error" component="span">{error}</Typography>}
    </Box>
  );
}
