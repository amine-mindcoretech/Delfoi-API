// src/components/Layout.jsx
import Header from './Header';
import Footer from './Footer';
import { Box } from '@mui/material';

function Layout({ children }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Header />
      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        {children}
      </Box>
      <Footer />
    </Box>
  );
}

export default Layout;