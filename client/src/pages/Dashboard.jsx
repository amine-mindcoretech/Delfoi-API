// src/pages/Dashboard.jsx
import { useState } from 'react';
import SyncCard from '../components/SyncCard';
import SequentialSync from '../components/SequentialSync';
import CustomSync from '../components/CustomSync';
import { Box, Typography, Alert } from '@mui/material';

function Dashboard({ syncTasks }) {
  const [logs, setLogs] = useState([]); // Shared logs state

  // Function to add a log to the shared logs
  const addLog = (message, severity = 'info') => {
    setLogs((prev) => [...prev, { message, severity, timestamp: new Date() }]);
  };

  console.log('syncTasks in Dashboard:', syncTasks); // Debug log

  return (
    <div style={{ padding: '20px' }}>
      <h1>Inventory Sync Dashboard</h1>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
        <SequentialSync syncTasks={syncTasks} addLog={addLog} />
        <CustomSync syncTasks={syncTasks} addLog={addLog} />
      </div>
      {/* Shared logs display */}
      {logs.length > 0 && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="subtitle1">Sync Logs</Typography>
          <Box sx={{ maxHeight: 200, overflowY: 'auto', mt: 2 }}>
            {logs.map((log, index) => (
              <Alert key={index} severity={log.severity} sx={{ mb: 1 }}>
                [{log.timestamp.toLocaleTimeString()}] {log.message}
              </Alert>
            ))}
          </Box>
        </Box>
      )}
      <h2>Individual Sync Operations</h2>
      <SyncCard 
        title="Importation depuis Genius vers la table genius_tbl_invitemslocori" 
        endpoint="/sync-genius-Tbl-InvItemsLocOri" 
        prefix="/api/sharepoint-tbl-invitems-locori" 
      />
      <SyncCard 
        title="Importation depuis SharePoint vers la table sharepoint_tbl_invitemslocori" 
        endpoint="/sync-sharepoint-Tbl-InvItemsLocOri" 
        prefix="/api/sharepoint-tbl-invitems-locori" 
      />
      <SyncCard 
        title="Importation depuis Genius vers la table genius_tbl_items" 
        endpoint="/sync-genius-Tbl-Items" 
        prefix="/api/sharepoint-tbl-invitems-locori" 
      />
      <SyncCard 
        title="Importation depuis SharePoint vers la table sharepoint_tbl_items" 
        endpoint="/sync-sharepoint-Tbl-Items" 
        prefix="/api/sharepoint-tbl-invitems-locori" 
      />
      <SyncCard 
        title="Importation depuis Genius vers la table genius_tbl_loc" 
        endpoint="/sync-genius-Tbl-Loc" 
        prefix="/api/sharepoint-tbl-loc" 
      />
      <SyncCard 
        title="Importation depuis SharePoint vers la table sharepoint_tbl_loc" 
        endpoint="/sync-sharepoint-Tbl-Loc" 
        prefix="/api/sharepoint-tbl-loc" 
      />
      <SyncCard 
        title="Remplacer la liste Tbl_InvItemsLocOri par celle de Genuis" 
        endpoint="/replace-with-genius-Tbl-InvItemsLocOri" 
        prefix="/api/sharepoint-tbl-invitems-locori" 
      />
      <SyncCard 
        title="Remplacer la liste Tbl_Items par celle de Genuis" 
        endpoint="/replace-with-genius-Tbl-Items" 
        prefix="/api/sharepoint-tbl-invitems-locori" 
      />
      <SyncCard 
        title="Remplacer la liste Tbl_Loc par celle de Genuis" 
        endpoint="/replace-with-genius-Tbl-Loc" 
        prefix="/api/sharepoint-tbl-loc" 
      />
    </div>
  );
}

export default Dashboard;