// src/App.js
import { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';

function App() {
  const [isReady, setIsReady] = useState(false);

  const syncTasks = [
    { 
      label: 'Importation depuis Genius vers la table genius_tbl_invitemslocori', 
      endpoint: '/sync-genius-Tbl-InvItemsLocOri', 
      prefix: '/api/sharepoint-tbl-invitems-locori' 
    },
    { 
      label: 'Importation depuis SharePoint vers la table sharepoint_tbl_invitemslocori', 
      endpoint: '/sync-sharepoint-Tbl-InvItemsLocOri', 
      prefix: '/api/sharepoint-tbl-invitems-locori' 
    },
    { 
      label: 'Importation depuis Genius vers la table genius_tbl_items', 
      endpoint: '/sync-genius-Tbl-Items', 
      prefix: '/api/sharepoint-tbl-invitems-locori' 
    },
    { 
      label: 'Importation depuis SharePoint vers la table sharepoint_tbl_items', 
      endpoint: '/sync-sharepoint-Tbl-Items', 
      prefix: '/api/sharepoint-tbl-invitems-locori' 
    },
    { 
      label: 'Importation depuis Genius vers la table genius_tbl_loc', 
      endpoint: '/sync-genius-Tbl-Loc', 
      prefix: '/api/sharepoint-tbl-loc' 
    },
    { 
      label: 'Importation depuis SharePoint vers la table sharepoint_tbl_loc', 
      endpoint: '/sync-sharepoint-Tbl-Loc', 
      prefix: '/api/sharepoint-tbl-loc' 
    },
    { 
      label: 'Remplacer la liste Tbl_InvItemsLocOri par celle de Genuis', 
      endpoint: '/replace-with-genius-Tbl-InvItemsLocOri', 
      prefix: '/api/sharepoint-tbl-invitems-locori' 
    },
    { 
      label: 'Remplacer la liste Tbl_Items par celle de Genuis', 
      endpoint: '/replace-with-genius-Tbl-Items', 
      prefix: '/api/sharepoint-tbl-invitems-locori' 
    },
    { 
      label: 'Remplacer la liste Tbl_Loc par celle de Genuis', 
      endpoint: '/replace-with-genius-Tbl-Loc', 
      prefix: '/api/sharepoint-tbl-loc' 
    }
  ];

  useEffect(() => {
    setIsReady(true);
  }, []);

  console.log('syncTasks in App:', syncTasks);

  if (!isReady) {
    return <div>Loading...</div>;
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/dashboard" element={<Dashboard syncTasks={syncTasks} />} />
      </Routes>
    </Layout>
  );
}

export default App;