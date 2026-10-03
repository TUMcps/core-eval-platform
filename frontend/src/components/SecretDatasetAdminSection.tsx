import { useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { COMPETITION_YEAR } from '../constants/formOptions';
import { apiErrorMessage, secretDatasetsApi, type SecretDataset } from '../api';
import { formatDateTime } from '../utils/datetime';

type Props = {
  defaultCategory?: string;
  defaultSeason?: string;
};

export default function SecretDatasetAdminSection({ defaultCategory = 'AFF', defaultSeason = String(COMPETITION_YEAR) }: Props) {
  const [datasets, setDatasets] = useState<SecretDataset[]>([]);
  const [category, setCategory] = useState(defaultCategory);
  const [season, setSeason] = useState(defaultSeason);
  const [archive, setArchive] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    secretDatasetsApi.list()
      .then((items) => { if (alive) setDatasets(items); })
      .catch((loadError: unknown) => { if (alive) setError(apiErrorMessage(loadError, 'Could not load secret datasets', 'detail')); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const upload = async () => {
    if (!archive) {
      setError('Choose a zip file to upload.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await secretDatasetsApi.upload({ category: category.trim(), season: season.trim(), archive });
      setArchive(null);
      setDatasets(await secretDatasetsApi.list());
    } catch (uploadError: unknown) {
      setError(apiErrorMessage(uploadError, 'Could not upload secret dataset', 'detail'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (dataset: SecretDataset) => {
    if (!window.confirm(`Delete ${dataset.category} ${dataset.season}?`)) return;
    setSaving(true);
    setError('');
    try {
      await secretDatasetsApi.delete(dataset.id);
      setDatasets(await secretDatasetsApi.list());
    } catch (deleteError: unknown) {
      setError(apiErrorMessage(deleteError, 'Could not delete secret dataset', 'detail'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ mt: 3, p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper' }}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="h6" fontWeight="bold">Secret benchmark data</Typography>
          <Typography variant="body2" color="text.secondary">
            AFF archives are extracted directly into the tool checkout root. The zip must contain
            a top-level <code>secret-data/</code> folder, for example <code>secret-data/rand01.json</code>.
          </Typography>
        </Box>

        {error && <Alert severity="error">{error}</Alert>}

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'flex-start' }}>
          <TextField label="Category" value={category} onChange={(event) => setCategory(event.target.value)} size="small" sx={{ minWidth: 160 }} />
          <TextField label="Season" value={season} onChange={(event) => setSeason(event.target.value)} size="small" sx={{ minWidth: 120 }} />
          <Button component="label" variant="outlined" sx={{ alignSelf: 'flex-start' }}>
            Choose zip
            <input hidden type="file" accept=".zip,application/zip" onChange={(event) => setArchive(event.target.files?.[0] ?? null)} />
          </Button>
          <Button variant="contained" onClick={() => { void upload(); }} disabled={saving} sx={{ alignSelf: 'flex-start' }}>
            {saving ? 'Saving…' : 'Upload'}
          </Button>
        </Stack>

        <Typography variant="body2" color={archive ? 'text.primary' : 'text.secondary'}>
          {archive ? archive.name : 'No zip selected.'}
        </Typography>

        <Stack spacing={1.5}>
          <Typography variant="subtitle2" color="text.secondary">Existing datasets</Typography>
          {loading ? (
            <Typography variant="body2" color="text.secondary">Loading…</Typography>
          ) : datasets.length ? (
            datasets.map((dataset) => (
              <Box key={dataset.id} sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ md: 'center' }} justifyContent="space-between">
                  <Box>
                    <Typography variant="body1" fontWeight="medium">{dataset.category} · {dataset.season}</Typography>
                    <Typography variant="body2" color="text.secondary">Uploaded {formatDateTime(dataset.uploaded_at)}</Typography>
                  </Box>
                  <Button color="error" variant="text" onClick={() => { void remove(dataset); }} disabled={saving}>
                    Delete
                  </Button>
                </Stack>
              </Box>
            ))
          ) : (
            <Typography variant="body2" color="text.secondary">No secret datasets uploaded yet.</Typography>
          )}
        </Stack>
      </Stack>
    </Box>
  );
}
