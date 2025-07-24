// src/components/SyncCard.jsx
import { useState } from 'react';
import { Card, CardContent, Typography, Button, CircularProgress, Box } from '@mui/material';
import { CheckCircle, Error } from '@mui/icons-material';
import axios from 'axios';

function SyncCard({ title, endpoint, prefix }) {
  const [status, setStatus] = useState(null);
  const [message, setMessage] = useState('');
  const [duration, setDuration] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSync = async () => {
    setLoading(true);
    setStatus(null);
    setMessage('');
    setDuration(null);

    try {
      const response = await axios.get(`http://localhost:5000${prefix}${endpoint}`);
      setStatus('success');
      setMessage(response.data.message);
      if (response.data.deletionDuration || response.data.insertionDuration) {
        const deletionMinutes = Math.floor(response.data.deletionDuration / 1000 / 60);
        const deletionSeconds = Math.floor((response.data.deletionDuration / 1000) % 60);
        const insertionMinutes = Math.floor(response.data.insertionDuration / 1000 / 60);
        const insertionSeconds = Math.floor((response.data.insertionDuration / 1000) % 60);
        setDuration(
          `Suppression: ${deletionMinutes} minute(s) et ${deletionSeconds} seconde(s), Insertion: ${insertionMinutes} minute(s) et ${insertionSeconds} seconde(s)`
        );
      }
    } catch (error) {
      setStatus('error');
      setMessage(error.response?.data?.error || 'Une erreur est survenue. Les opérations ont été relancées jusqu\'à 10 fois en cas d\'échec.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          {title}
        </Typography>
        <Button
          variant="contained"
          color="primary"
          onClick={handleSync}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} /> : null}
        >
          {loading ? 'En cours...' : 'Exécuter'}
        </Button>
        {status && (
          <Box mt={2} display="flex" alignItems="center">
            {status === 'success' ? (
              <CheckCircle color="success" sx={{ mr: 1 }} />
            ) : (
              <Error color="error" sx={{ mr: 1 }} />
            )}
            <Typography variant="body2" color={status === 'success' ? 'green' : 'error'}>
              {message}
            </Typography>
          </Box>
        )}
        {duration && (
          <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
            {duration}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

export default SyncCard;