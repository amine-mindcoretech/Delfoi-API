// src/components/SequentialSync.jsx
import { useState } from 'react';
import { Button, CircularProgress } from '@mui/material';
import axios from 'axios';

function SequentialSync({ syncTasks, addLog }) {
  const [running, setRunning] = useState(false);
  const [currentTask, setCurrentTask] = useState(null);
  const MAX_RETRIES = 3;

  const runTask = async (task, attempt = 1) => {
    addLog(`Starting ${task.label} (Attempt ${attempt}/${MAX_RETRIES})...`);
    try {
      const response = await axios.get(`http://localhost:5000${task.prefix}${task.endpoint}`);
      addLog(`${task.label} completed successfully: ${response.data.message}`, 'success');
      return { success: true, response };
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'An error occurred';
      addLog(`${task.label} failed: ${errorMessage}`, 'error');
      if (attempt < MAX_RETRIES) {
        addLog(`Retrying ${task.label} (Attempt ${attempt + 1}/${MAX_RETRIES})...`, 'warning');
        return await runTask(task, attempt + 1);
      }
      addLog(`${task.label} failed after ${MAX_RETRIES} attempts.`, 'error');
      return { success: false, error: errorMessage };
    }
  };

  const runSequentialSync = async () => {
    setRunning(true);
    setCurrentTask(null);

    for (const task of syncTasks) {
      setCurrentTask(task.label);
      const result = await runTask(task);
      if (!result.success) {
        addLog(`Stopping sequential sync due to failure in ${task.label}.`, 'error');
        break;
      }
    }

    setRunning(false);
    setCurrentTask(null);
  };

  return (
    <Button
      variant="contained"
      color="primary"
      onClick={runSequentialSync}
      disabled={running}
      startIcon={running ? <CircularProgress size={20} /> : null}
      sx={{ mb: 2, width: 200, height: 42 }}
    >
      {running ? `Running: ${currentTask || '...'}` : 'Run Sequential Sync'}
    </Button>
  );
}

export default SequentialSync;