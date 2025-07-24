// src/pages/Home.jsx
import { Link } from 'react-router-dom';
import { Typography, Button, Box } from '@mui/material';

function Home() {
  return (
    <Box sx={{ textAlign: 'center', mt: 5 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', color: 'primary.main' }}>
        Welcome to SharePoint Sync
      </Typography>
      <Typography variant="body1" gutterBottom sx={{ mb: 3, color: 'text.secondary' }}>
        Synchronize your SharePoint and Genius data effortlessly with a modern, user-friendly interface.
      </Typography>
      <Button
        variant="contained"
        color="primary"
        component={Link}
        to="/dashboard"
        sx={{ px: 4, py: 1.5 }}
      >
        Go to Dashboard
      </Button>
    </Box>
  );
}

export default Home;