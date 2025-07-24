// src/components/Header.jsx
import { Link } from 'react-router-dom';
import { AppBar, Toolbar, Typography, Button } from '@mui/material';

function Header() {
  return (
    <AppBar position="static" sx={{ bgcolor: 'primary.dark' }}>
      <Toolbar sx={{ justifyContent: 'space-between' }}>
        <Typography variant="h6" component="div" sx={{ fontWeight: 'bold' }}>
          SharePoint Sync
        </Typography>
        <div>
          <Button color="inherit" component={Link} to="/" sx={{ mr: 2 }}>
            Home
          </Button>
          <Button color="inherit" component={Link} to="/dashboard">
            Dashboard
          </Button>
        </div>
      </Toolbar>
    </AppBar>
  );
}

export default Header;