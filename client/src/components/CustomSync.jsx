// src/components/CustomSync.jsx
import { useState, useEffect } from 'react';
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  Checkbox,
  Typography,
  CircularProgress,
  TextField
} from '@mui/material';
import axios from 'axios';

// Sortable Item Component (simplified to handle order input)
function OrderItem({ task, selectedTasks, handleToggleTask, order, setOrder }) {
  const handleOrderChange = (event) => {
    const newOrder = event.target.value === '' ? '' : parseInt(event.target.value, 10) || 0;
    setOrder(task.label, newOrder);
  };

  return (
    <ListItem sx={{ border: '1px solid #ddd', mb: 1, borderRadius: 4 }}>
      <Checkbox
        checked={selectedTasks.includes(task.label)}
        onChange={() => handleToggleTask(task.label)}
      />
      <ListItemText primary={task.label} />
      <TextField
        type="number"
        value={order[task.label] || ''}
        onChange={handleOrderChange}
        inputProps={{ min: 0 }}
        size="small"
        sx={{ ml: 2, width: '80px' }}
        placeholder="Order"
      />
    </ListItem>
  );
}

function CustomSync({ syncTasks = [], addLog }) {
  const [open, setOpen] = useState(false);
  const [selectedTasks, setSelectedTasks] = useState([]);
  const [orderedTasks, setOrderedTasks] = useState([]);
  const [orderMap, setOrderMap] = useState({}); // Map to store order numbers for each task
  const [running, setRunning] = useState(false);
  const [currentTask, setCurrentTask] = useState(null);
  const MAX_RETRIES = 3;

  // Initialize state when syncTasks is received
  useEffect(() => {
    console.log('syncTasks received in CustomSync:', syncTasks);
    if (Array.isArray(syncTasks)) {
      setOrderedTasks(syncTasks);
      setSelectedTasks(syncTasks.map(task => task.label));
      // Initialize orderMap with default values (0 or sequential)
      const initialOrder = syncTasks.reduce((acc, task, index) => ({
        ...acc,
        [task.label]: index + 1
      }), {});
      setOrderMap(initialOrder);
    } else {
      console.warn('syncTasks is not an array:', syncTasks);
      setOrderedTasks([]);
      setSelectedTasks([]);
      setOrderMap({});
    }
  }, [syncTasks]);

  // Log orderedTasks to debug
  useEffect(() => {
    console.log('orderedTasks updated:', orderedTasks);
  }, [orderedTasks]);

  const handleOpen = () => {
    setOpen(true);
    if (Array.isArray(syncTasks)) {
      setSelectedTasks(syncTasks.map(task => task.label));
      setOrderedTasks(syncTasks);
      // Reinitialize orderMap when opening dialog
      const initialOrder = syncTasks.reduce((acc, task, index) => ({
        ...acc,
        [task.label]: index + 1
      }), {});
      setOrderMap(initialOrder);
    } else {
      setSelectedTasks([]);
      setOrderedTasks([]);
      setOrderMap({});
    }
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleToggleTask = (taskLabel) => {
    if (selectedTasks.includes(taskLabel)) {
      setSelectedTasks(selectedTasks.filter(label => label !== taskLabel));
    } else {
      setSelectedTasks([...selectedTasks, taskLabel]);
    }
  };

  const setOrder = (taskLabel, newOrder) => {
    setOrderMap(prev => ({
      ...prev,
      [taskLabel]: newOrder
    }));
  };

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

  const runCustomSync = async () => {
    setRunning(true);
    setCurrentTask(null);
    setOpen(false);

    // Create a sorted array based on orderMap
    const tasksToRun = [...orderedTasks]
      .filter(task => selectedTasks.includes(task.label))
      .sort((a, b) => {
        const orderA = orderMap[a.label] || 0;
        const orderB = orderMap[b.label] || 0;
        return orderA - orderB;
      });

    for (const task of tasksToRun) {
      setCurrentTask(task.label);
      const result = await runTask(task);
      if (!result.success) {
        addLog(`Stopping custom sync due to failure in ${task.label}.`, 'error');
        break;
      }
    }

    setRunning(false);
    setCurrentTask(null);
  };

  return (
    <>
      <Button
        variant="contained"
        color="primary"
        onClick={handleOpen}
        disabled={running}
        startIcon={running ? <CircularProgress size={20} /> : null}
        sx={{ mb: 2, ml: 2, width: 200, height: 42 }}
      >
        {running ? `Running: ${currentTask || '...'}` : 'Custom Sync'}
      </Button>

      <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
        <DialogTitle>Select and Order Sync Tasks</DialogTitle>
        <DialogContent>
          {orderedTasks.length > 0 ? (
            <List>
              {orderedTasks.map((task) => (
                <OrderItem
                  key={task.label}
                  task={task}
                  selectedTasks={selectedTasks}
                  handleToggleTask={handleToggleTask}
                  order={orderMap}
                  setOrder={setOrder}
                />
              ))}
            </List>
          ) : (
            <Typography>No tasks available to sync.</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} color="primary">
            Cancel
          </Button>
          <Button onClick={runCustomSync} color="primary" disabled={selectedTasks.length === 0}>
            Run Selected Tasks
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default CustomSync;