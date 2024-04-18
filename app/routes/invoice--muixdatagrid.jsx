import { Form, useLoaderData, useTransition, useFetcher } from "@remix-run/react";
import { json } from "@remix-run/node";
import { useState } from 'react';

import { auth } from "~/firebase-service";
import { isSessionValid, sessionLogout } from "~/fb.sessions.server";

import { Autocomplete, TextField, Button, Grid, Typography, Paper } from '@mui/material';


import Box from '@mui/material/Box';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Close';
import {
  GridRowModes,
  DataGrid,
  GridToolbarContainer,
  GridActionsCellItem,
  GridRowEditStopReasons,
} from '@mui/x-data-grid';

import {v4 as randomId} from 'uuid';  

// Mock Loader Functions
async function loadUsers() {
  // Simulate fetching users from the database
  return [
    { id: 1, name: 'User 1', hourlyRate: 25 },
    { id: 2, name: 'User 2', hourlyRate: 22 },
    { id: 3, name: 'User 3', hourlyRate: 20 },
  ];
}

async function loadCustomers() {
  // Simulate fetching customers from the database
  return [
    { id: 1, name: 'Customer 1', billRate: 35, billRateType: 'hourly'},
    { id: 2, name: 'Customer 2', billRate: 30, billRateType: 'hourly'},
    { id: 3, name: 'Customer 3', billRate: 40, billRateType: 'hourly'},
  ];
}
///


// use loader to check for existing session
export async function loader({ request }) {
  const { decodedClaims, error } = await isSessionValid(request, "/login");

  const COLLECTION_NAME = "invoices";
  const PROJECT_ID = decodedClaims.aud;

  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${COLLECTION_NAME}`
  );
  const { documents } = await response.json();


  const [users, customers] = await Promise.all([loadUsers(), loadCustomers()]);


  console.log("documents", JSON.stringify(documents));

  const data = {
    error,
    decodedClaims,
    responseData: documents,
    users,
    customers,
  };
  return json(data);
}

  
  function EditToolbar(props) {
    const { setRows, setRowModesModel } = props;
  
    const handleClick = () => {
      const id = randomId();
      setRows((oldRows) => [...oldRows, { id, name: '', age: '', isNew: true }]);
      setRowModesModel((oldModel) => ({
        ...oldModel,
        [id]: { mode: GridRowModes.Edit, fieldToFocus: 'name' },
      }));
    };
  
    return (
      <GridToolbarContainer>
        <Button color="primary" startIcon={<AddIcon />} onClick={handleClick}>
          Add record
        </Button>
      </GridToolbarContainer>
    );
  }

export async function action({ request }) {
  return await sessionLogout(request);
}

// https://remix.run/api/conventions#meta
export const meta = () => {
  return {
    title: "Remix Starter Firebase ",
    description: "Welcome to remix with firebase!",
  };
};

// https://remix.run/guides/routing#index-routes
export default function Invoice() {
  const logoutFetcher = useFetcher();
  const data = useLoaderData();
  const greeting = data?.decodedClaims
    ? "Logged In As: " + data?.decodedClaims?.email
    : "Log In My: friend";

  console.log(data);

  const { users, customers } = data;
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [rowModesModel, setRowModesModel] = useState({});
  const [rows, setRows] = useState([
    {id: 1, person: '', quantity: '', total: ''},
    {id: 2, person: '', quantity: '', total: ''},
    {id: 3, person: '', quantity: '', total: ''},
  ]);

  const handleDateChange = (date) => {
    setSelectedDate(date);
  };

  const handleCustomerChange = (event, value) => {
    setSelectedCustomer(value);
  };

  const handleRowReorder = (newRows) => {
    setRows(newRows);
  };

  const handleRowEditStop = (params, event) => {
    if (params.reason === GridRowEditStopReasons.rowFocusOut) {
      event.defaultMuiPrevented = true;
    }
  };

  const handleEditClick = (id) => () => {
    setRowModesModel({ ...rowModesModel, [id]: { mode: GridRowModes.Edit } });
  };

  const handleSaveClick = (id) => () => {
    setRowModesModel({ ...rowModesModel, [id]: { mode: GridRowModes.View } });
  };

  const handleDeleteClick = (id) => () => {
    setRows(rows.filter((row) => row.id !== id));
  };

  const handleCancelClick = (id) => () => {
    setRowModesModel({
      ...rowModesModel,
      [id]: { mode: GridRowModes.View, ignoreModifications: true },
    });

    const editedRow = rows.find((row) => row.id === id);
    if (editedRow?.isNew) {
      setRows(rows.filter((row) => row.id !== id));
    }
  };

  const processRowUpdate = (newRow) => {
    const updatedRow = { ...newRow, isNew: false };
    setRows(rows.map((row) => (row.id === newRow.id ? updatedRow : row)));
    return updatedRow;
  };

  const handleRowModesModelChange = (newRowModesModel) => {
    setRowModesModel(newRowModesModel);
  };

  const columns = [
    { field: 'person', headerName: 'Person', width: 200, sortable: true, editable: true, type: 'singleSelect', valueOptions: users.map((user) => ({ label: user.name, value: user.id })) },
    { field: 'quantity', headerName: 'Quantity', width: 80, sortable: true, editable: true, type: 'number' },
    { field: 'total', headerName: 'Total', width: 100, sortable: true, editable: false, type: 'number', 
        valueGetter: (_, row) => {
            return row?.quantity * selectedCustomer?.billRate;
        },
    },

    {
        field: 'actions',
        type: 'actions',
        headerName: 'Actions',
        width: 100,
        cellClassName: 'actions',
        getActions: ({ id }) => {
          const isInEditMode = (rowModesModel || {})[id]?.mode === GridRowModes.Edit;
  
          if (isInEditMode) {
            return [
              <GridActionsCellItem
                key="0"
                icon={<SaveIcon />}
                label="Save"
                sx={{
                  color: 'primary.main',
                }}
                onClick={handleSaveClick(id)}
              />,
              <GridActionsCellItem
                key="1"
                icon={<CancelIcon />}
                label="Cancel"
                className="textPrimary"
                onClick={handleCancelClick(id)}
                color="inherit"
              />,
            ];
          }
  
          return [
            <GridActionsCellItem
              key="0"
              icon={<EditIcon />}
              label="Edit"
              className="textPrimary"
              onClick={handleEditClick(id)}
              color="inherit"
            />,
            <GridActionsCellItem
              key="1"
              icon={<DeleteIcon />}
              label="Delete"
              onClick={handleDeleteClick(id)}
              color="inherit"
            />,
          ];
        },
    },
  ];

  const transition = useTransition();


  const logout = async () => {
    await auth.signOut();
    logoutFetcher.submit({}, { method: "POST" });
  };

  return (
    <div className="ui container centered" style={{ paddingTop: 40 }}>
      <div className="ui segment">
        <h3>{greeting}</h3>
        <div>
          <button className="ui button" type="button" onClick={() => logout()}>
            Log Out
          </button>
        </div>
      </div>

      <Paper style={{ padding: '20px', marginBottom: '20px' }}>
        <Typography variant="h5" gutterBottom>
          Invoice Intake Form
        </Typography>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={6}>
            <Autocomplete
              id="customer-select"
              options={customers}
              getOptionLabel={(option) => option.name}
              onChange={handleCustomerChange}
              renderInput={(params) => <TextField {...params} label="Select Customer" />}
            />
          </Grid>
          <Grid item xs={6}>
            <TextField
              id="date"
              label="Select Date"
              type="date"
              value={selectedDate.toISOString().slice(0, 10)}
              onChange={(e) => handleDateChange(new Date(e.target.value))}
              InputLabelProps={{
                shrink: true,
              }}
            />
          </Grid>
        </Grid>
        <div style={{ height: 400, width: '100%', marginTop: '20px' }}>
          <DataGrid
            rows={rows}
            columns={columns}
            editMode="row"
            hideFooter={true}
            columnHeaders={() => {}}
            components={{
              rowDraggable: true,
            }}
            onRowDragEnd={(newRows) => handleRowReorder(newRows.rows)}
          />
        </div>
        <Button variant="contained" color="primary" style={{ marginTop: '20px' }}>
          Submit
        </Button>
      </Paper>

    </div>
  );
}
