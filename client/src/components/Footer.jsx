// src/components/Footer.jsx
import { Box, Typography } from '@mui/material';

function Footer() {
  return (
    <Box sx={{ bgcolor: 'grey.900', color: 'white', p: 2, mt: 'auto', textAlign: 'center' }}>
      <Typography variant="body2">
        © {new Date().getFullYear()} SharePoint Sync. Mindcore Technologies.
      </Typography>
    </Box>
  );
}

export default Footer;