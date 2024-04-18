import {Form, useLoaderData, useTransition, useFetcher} from "@remix-run/react";

import {json} from "@remix-run/node";
import {useState, useMemo} from 'react';

import {auth} from "~/firebase-service";
import {isSessionValid, sessionLogout} from "~/fb.sessions.server";

import {Autocomplete, TextField, Button, Grid, Typography, Paper} from '@mui/material';

import {v4 as randomId} from 'uuid';

import Box from '@mui/material/Box';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Close';

import {
    flexRender,
    getCoreRowModel,
    useReactTable,
} from '@tanstack/react-table'

// needed for table body level scope DnD setup
import {
    DndContext,
    KeyboardSensor,
    MouseSensor,
    TouchSensor,
    closestCenter,
    useSensor,
    useSensors,
} from '@dnd-kit/core'
import {restrictToVerticalAxis} from '@dnd-kit/modifiers'
import {
    arrayMove,
    SortableContext,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable'

// needed for row & cell level scope DnD setup
import {useSortable} from '@dnd-kit/sortable'
import {CSS} from '@dnd-kit/utilities'

// Cell Component
const RowDragHandleCell = ({rowId}) => {
    const {attributes, listeners} = useSortable({
        id: rowId,
    })
    return (
        // Alternatively, you could set these attributes on the rows themselves
        <button {...attributes} {...listeners}>
            🟰
        </button>
    )
}

// Row Component
const DraggableRow = ({row}) => {
    const {transform, transition, setNodeRef, isDragging} = useSortable({
        id: row.original.id,
    })

    const style = {
        transform: CSS.Transform.toString(transform), //let dnd-kit do its thing
        transition: transition,
        opacity: isDragging ? 0.8 : 1,
        zIndex: isDragging ? 1 : 0,
        position: 'relative',
    }
    return (
        // connect row ref to dnd-kit, apply important styles
        <tr ref={setNodeRef} style={style}>
            {row.getVisibleCells().map(cell => (
                <td key={cell.id} style={{width: cell.column.getSize()}}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
            ))}
        </tr>
    )
}



// Mock Loader Functions
async function loadUsers() {
    // Simulate fetching users from the database
    return [
        {id: 1, name: 'User 1', hourlyRate: 25},
        {id: 2, name: 'User 2', hourlyRate: 22},
        {id: 3, name: 'User 3', hourlyRate: 20},
    ];
}

async function loadCustomers() {
    // Simulate fetching customers from the database
    return [
        {id: 1, name: 'Customer 1', billRate: 35, billRateType: 'hourly'},
        {id: 2, name: 'Customer 2', billRate: 30, billRateType: 'hourly'},
        {id: 3, name: 'Customer 3', billRate: 40, billRateType: 'hourly'},
    ];
}

///


// use loader to check for existing session
export async function loader({request}) {
    const {decodedClaims, error} = await isSessionValid(request, "/login");

    const COLLECTION_NAME = "invoices";
    const PROJECT_ID = decodedClaims.aud;

    const response = await fetch(
        `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${COLLECTION_NAME}`
    );
    const {documents} = await response.json();


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


// https://remix.run/api/conventions#action
export async function action({request}) {
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
export default function InvoiceTanstackRowDnd() {
    const loaderData = useLoaderData();

    console.log(loaderData);

    const {users, customers} = loaderData;
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [rowModesModel, setRowModesModel] = useState({});
    const [rows, setRows] = useState([
        {id: 1, person: '', quantity: '', total: ''},
        {id: 2, person: '', quantity: '', total: ''},
        {id: 3, person: '', quantity: '', total: ''},
    ]);

    // const [getTableProps, {headerGroups, rows: tableRows, prepareRow}] = useTable({columns: []}, useRowOrder);

    const handleDateChange = (date) => {
        setSelectedDate(date);
    };

    const handleCustomerChange = (event, value) => {
        setSelectedCustomer(value);
    };

    const handleRowReorder = (newRows) => {
        setRows(newRows);
    };

    //////////////////
    /// new
    //////////////////
    const columns = [
            // Create a dedicated drag handle column. Alternatively, you could just set up dnd events on the rows themselves.
            {
                id: 'drag-handle',
                header: '',
                cell: ({ row }) => <RowDragHandleCell rowId={row.id} />,
                size: 60,
            },
            {
                accessorKey: 'name',
                header: '',
            },
            {
                accessorKey: 'quantity',
                header: 'Qty.',
            },
            {
                accessorFn: (row) => (
                    selectedCustomer?.billRate && row.quantity
                    ? (selectedCustomer.billRate * row.quantity).toFixed(2)
                    : ''
                ),
                header: 'Total',
            },
        ];

    const [data, setData] = useState([
        {id: 1, name: 'me', quantity: 2},
        {id: 2, name: 'you', quantity: 3},
        {id: 3, name: 'them', quantity: 4},
    ])

    const dataIds = useMemo(
        () => data?.map(({ id }) => id),
            [data]
    )

    const rerender = () => {};

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getRowId: row => row.id, //required because row indexes will change
        debugTable: true,
        debugHeaders: true,
        debugColumns: true,
    })

    // reorder rows after drag & drop
    function handleDragEnd(event) {
        const { active, over } = event
        if (active && over && active.id !== over.id) {
            setData(data => {
                const oldIndex = dataIds.indexOf(active.id)
                const newIndex = dataIds.indexOf(over.id)
                return arrayMove(data, oldIndex, newIndex) //this is just a splice util
            });
        }
    }

    const sensors = useSensors(
        useSensor(MouseSensor, {}),
        useSensor(TouchSensor, {}),
        useSensor(KeyboardSensor, {})
    );

    //////////////////


    return (
        <div className="ui container centered" style={{paddingTop: 40}}>

            <Paper style={{padding: '20px', marginBottom: '20px'}}>
                <Typography variant="h5" gutterBottom>
                    New Invoice
                </Typography>

                <Grid container spacing={2} alignItems="center">
                    <Grid item xs={6}>
                        <Autocomplete
                            id="customer-select"
                            options={customers}
                            getOptionLabel={(option) => option.name}
                            onChange={handleCustomerChange}
                            renderInput={(params) => <TextField {...params} label="Select Customer"/>}
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




                <Button variant="contained" color="primary" style={{marginTop: '20px'}}>
                    Submit
                </Button>
            </Paper>


            <DndContext
                collisionDetection={closestCenter}
                modifiers={[restrictToVerticalAxis]}
                onDragEnd={handleDragEnd}
                sensors={sensors}
            >
                <div className="p-2">
                    <div className="h-4" />
                    <div className="flex flex-wrap gap-2">
                        <button onClick={() => rerender()} className="border p-1">
                            Add Row
                        </button>
                    </div>
                    <div className="h-4" />
                    <table>
                        <thead>
                        {table.getHeaderGroups().map(headerGroup => (
                            <tr key={headerGroup.id}>
                                {headerGroup.headers.map(header => (
                                    <th key={header.id} colSpan={header.colSpan}>
                                        {header.isPlaceholder
                                            ? null
                                            : flexRender(
                                                header.column.columnDef.header,
                                                header.getContext()
                                            )}
                                    </th>
                                ))}
                            </tr>
                        ))}
                        </thead>
                        <tbody>
                        <SortableContext
                            items={dataIds}
                            strategy={verticalListSortingStrategy}
                        >
                            {table.getRowModel().rows.map(row => (
                                <DraggableRow key={row.id} row={row} />
                            ))}
                        </SortableContext>
                        </tbody>
                    </table>
                </div>
            </DndContext>
        </div>
    );
}
