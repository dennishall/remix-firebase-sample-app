import { json } from "@remix-run/node";
import {db} from '../firebase-service';
import { collection, doc, getDocs, setDoc, addDoc } from "firebase/firestore";
import adminApp from '../lib/firebase.admin.server';

import { getAuth } from 'firebase/auth';
import mantineCoreStyles from '@mantine/core/styles.css';
import mantineTableStyles from 'mantine-react-table/styles.css'; //make sure MRT styles were imported in your app root (once)
// import '@mantine/dates/styles.css'; //if using mantine date picker features
import {useEffect, useMemo, useState} from 'react';
import {
  MantineReactTable,
  // createRow,
  type MRT_ColumnDef,
  type MRT_Row,
  type MRT_TableOptions,
  useMantineReactTable,
} from 'mantine-react-table';
import { ActionIcon, Button, Text, Tooltip, MantineProvider } from '@mantine/core';
import { ModalsProvider, modals } from '@mantine/modals';
import { IconTrash } from '@tabler/icons-react';
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { type User, fakeData, usStates } from '../utils/makeData';
import { documentToJson } from '../utils/firestore-utils';
import {v4 as uuid} from 'uuid';

import { isSessionValid, sessionLogout } from "~/fb.sessions.server";
import {useLoaderData} from "@remix-run/react";

export const links = () => {
    return [
        { rel: "stylesheet", href: mantineCoreStyles },
        { rel: "stylesheet", href: mantineTableStyles },
    ];
};

// use loader to check for existing session
export async function loader({ request }) {
    const { decodedClaims, error } = await isSessionValid(request, "/login");

    // const COLLECTION_NAME = "workers";
    // const PROJECT_ID = decodedClaims.aud;
    // const response = await fetch(
    //     `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${COLLECTION_NAME}`
    // );
    // const { documents } = await response.json();
    // console.log("documents", JSON.stringify(documents));

    let documents = [];
    if (typeof adminApp === 'undefined') {
        console.log('!!! no admin app');
        documents = [];
    } else {
        console.log({invoicePage: adminApp})
        const d = await adminApp.auth().listUsers(1000);
        console.log({users: d?.users});
        documents = d.users;
    }

    const data = {
        error,
        decodedClaims,
        responseData: documents,
    };
    return json(data);
}

export const action = async ({ request }) => {
    const { decodedClaims, error, isAdmin } = await isSessionValid(request, "/login");
    if (!isAdmin) {
        return new Response('Unauthorized', { status: 403 });
    }
    const formData = await request.formData();
    const intent = formData.get("intent");
    switch (intent) {
        case "create-user":
        case "update-user": {

            const fieldNames = 'name,email,password,phone,role,hourlyRate,street,city,state,postalCode';

            const workerData = fieldNames.split(',').reduce((result, fieldName) => {
                return {
                    ...result,
                    [fieldName]: (formData.get(fieldName) || '').trim(),
                };
            }, {});

            workerData.hourlyRate = parseFloat(workerData.hourlyRate, 10);

            const errors = {
                name: !workerData.name || workerData.name.length === 0 ? 'Name is required' : null,
                email: workerData.email && !/.*?@.*?\..*?/.test(workerData.email) ? 'Email is required' : null,
                password: (workerData.password || '').length < 10 ? 'Password is required, must be at least 10 characters' : null,
                phone: (workerData.phone || '').length < 10 ? 'Phone must be 10 digits' : null,
                hourlyRate: !workerData.hourlyRate || workerData.hourlyRate.length === 0 ? 'Hourly rate is required' : null,
            };
            const hasError = anyTrue(errors);

            if (hasError) {
                return json({ errors });
            }

            const worker = await updateUser(workerData);

            // todo - handle 500 and other server errors

            return redirect(`/workers`);
        }
    }
    return new Response(`Unsupported intent: ${intent}`, { status: 400 });
};



const Example = () => {
  const [validationErrors, setValidationErrors] = useState<Record<string, string | undefined>>({});
  const data = useLoaderData();
  const [workers, setWorkers] = useState();
  //keep track of rows that have been edited
  const [editedUsers, setEditedUsers] = useState<Record<string, User>>({});

  //call CREATE hook
  const { mutateAsync: createUser, isPending: isCreatingUser } =
      useCreateUser();
  //call READ hook
  const {
    data: fetchedUsers = [],
    isError: isLoadingUsersError,
    isFetching: isFetchingUsers,
    isLoading: isLoadingUsers,
  } = useGetUsers();
  //call UPDATE hook
  const { mutateAsync: updateUsers, isPending: isUpdatingUser } =
      useUpdateUsers();
  //call DELETE hook
  const { mutateAsync: deleteUser, isPending: isDeletingUser } =
      useDeleteUser();

  //CREATE action
  const handleCreateUser: MRT_TableOptions<User>['onCreatingRowSave'] = async ({
    values,
    exitCreatingMode,
  }) => {
    const newValidationErrors = validateUser(values);
    if (Object.values(newValidationErrors).some((error) => !!error)) {
      setValidationErrors(newValidationErrors);
      return;
    }
    values.id = uuid();
    setValidationErrors({});
    await addDoc(collection(db, 'workers'), values);
    await createUser(values);
    exitCreatingMode();
  };

  //UPDATE action
  const handleSaveUsers = async () => {
    if (Object.values(validationErrors).some((error) => !!error)) return;
    await updateUsers(Object.values(editedUsers));
    setEditedUsers({});
  };

  //DELETE action
  const openDeleteConfirmModal = (row: MRT_Row<User>) =>
      modals.openConfirmModal({
        title: 'Are you sure you want to delete this user?',
        children: (
            <Text>
              Are you sure you want to delete {row.original.firstName}{' '}
              {row.original.lastName}? This action cannot be undone.
            </Text>
        ),
        labels: { confirm: 'Delete', cancel: 'Cancel' },
        confirmProps: { color: 'red' },
        onConfirm: () => deleteUser(row.original.id),
      });

  const columns = useMemo<MRT_ColumnDef<User>[]>(
      () => [
        {
          accessorKey: 'id',
          header: 'Id',
          enableEditing: false,
          size: 80,
        },
        {
          accessorKey: 'firstName',
          header: 'First Name',
          mantineEditTextInputProps: ({ cell, row }) => ({
            type: 'text',
            required: true,
            error: validationErrors?.[cell.id],
            //store edited user in state to be saved later
            onBlur: (event) => {
              const validationError = !validateRequired(event.currentTarget.value)
                  ? 'Required'
                  : undefined;
              setValidationErrors({
                ...validationErrors,
                [cell.id]: validationError,
              });
              setEditedUsers({ ...editedUsers, [row.id]: row.original });
            },
          }),
        },
        {
          accessorKey: 'lastName',
          header: 'Last Name',
          mantineEditTextInputProps: ({ cell, row }) => ({
            type: 'text',
            required: true,
            error: validationErrors?.[cell.id],
            //store edited user in state to be saved later
            onBlur: (event) => {
              const validationError = !validateRequired(event.currentTarget.value)
                  ? 'Required'
                  : undefined;
              setValidationErrors({
                ...validationErrors,
                [cell.id]: validationError,
              });
              setEditedUsers({ ...editedUsers, [row.id]: row.original });
            },
          }),
        },
        {
          accessorKey: 'email',
          header: 'Email',
          mantineEditTextInputProps: ({ cell, row }) => ({
            type: 'email',
            required: true,
            error: validationErrors?.[cell.id],
            //store edited user in state to be saved later
            onBlur: (event) => {
              const validationError = !validateEmail(event.currentTarget.value)
                  ? 'Invalid Email'
                  : undefined;
              setValidationErrors({
                ...validationErrors,
                [cell.id]: validationError,
              });
              setEditedUsers({ ...editedUsers, [row.id]: row.original });
            },
          }),
        },
        {
          accessorKey: 'state',
          header: 'State',
          editVariant: 'select',
          mantineEditSelectProps: ({ row }) => ({
            data: usStates,
            //store edited user in state to be saved later
            onChange: (value: any) =>
                setEditedUsers({
                  ...editedUsers,
                  [row.id]: { ...row.original, state: value },
                }),
          }),
        },
      ],
          [editedUsers, validationErrors],
  );

  const table = useMantineReactTable({
    columns,
    data: fetchedUsers,
    createDisplayMode: 'row', // ('modal', and 'custom' are also available)
    editDisplayMode: 'table', // ('modal', 'row', 'cell', and 'custom' are also available)
    enableEditing: true,
    enableRowActions: true,
    positionActionsColumn: 'last',
    getRowId: (row) => row.id,
    mantineToolbarAlertBannerProps: isLoadingUsersError
        ? {
          color: 'red',
          children: 'Error loading data',
        }
        : undefined,
    mantineTableContainerProps: {
      style: {
        minHeight: '500px',
      },
    },
    onCreatingRowCancel: () => setValidationErrors({}),
    onCreatingRowSave: handleCreateUser,
    renderRowActions: ({ row }) => (
        <Tooltip label="Delete">
          <ActionIcon color="red" onClick={() => openDeleteConfirmModal(row)}>
            <IconTrash />
          </ActionIcon>
        </Tooltip>
    ),
    renderBottomToolbarCustomActions: () => (
        <Button
            color="blue"
            onClick={handleSaveUsers}
            disabled={
              Object.keys(editedUsers).length === 0 ||
              Object.values(validationErrors).some((error) => !!error)
            }
            loading={isUpdatingUser}
        >
          Save
        </Button>
    ),
    renderTopToolbarCustomActions: ({ table }) => (
        <Button
            onClick={() => {
              table.setCreatingRow(true); //simplest way to open the create row modal with no default values
              //or you can pass in a row object to set default values with the `createRow` helper function
              // table.setCreatingRow(
              //   createRow(table, {
              //     //optionally pass in default values for the new row, useful for nested data or other complex scenarios
              //   }),
              // );
            }}
        >
          Create New User
        </Button>
    ),
    state: {
      isLoading: isLoadingUsers,
      isSaving: isCreatingUser || isUpdatingUser || isDeletingUser,
      showAlertBanner: isLoadingUsersError,
      showProgressBars: isFetchingUsers,
    },
  });


    useEffect(() => {
        getDocs(collection(db, 'workers')).then((q) => {
            const nextWorkers = [];
            q.forEach(item => {
                nextWorkers.push(item.data());
            });
            setWorkers(nextWorkers);
        });
    }, []);

  return (
      <>
          <MantineReactTable table={table} />
          <div className="ui segment">
              <div className="ui medium header">Querying Firestore Database</div>
              {(data.responseData || []).map((m) => (
                  <div className="ui segment" key={m?.id}>
                      <pre>{JSON.stringify(m, null, 4)}</pre>
                  </div>
              ))}
          </div>
      </>
  );
};

//CREATE hook (post new user to api)
function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (user: User) => {
      //send api update request here
      await new Promise((resolve) => setTimeout(resolve, 1000)); //fake api call
      return Promise.resolve();
    },
    //client side optimistic update
    onMutate: (newUserInfo: User) => {
      queryClient.setQueryData(
          ['users'],
          (prevUsers: any) =>
              [
                ...prevUsers,
                {
                  ...newUserInfo,
                  id: (Math.random() + 1).toString(36).substring(7),
                },
              ] as User[],
    );
    },
    // onSettled: () => queryClient.invalidateQueries({ queryKey: ['users'] }), //refetch users after mutation, disabled for demo
  });
}

//READ hook (get users from api)
function useGetUsers() {
  return useQuery<User[]>({
    queryKey: ['users'],
    queryFn: async () => {
      //send api request here
      // await new Promise((resolve) => setTimeout(resolve, 1000)); //fake api call
      // return Promise.resolve(fakeData);
      const q = await getDocs(collection(db, 'workers')); // .then((q) => {
      const nextWorkers = [];
      q.forEach(item => {
        nextWorkers.push(item.data());
      });
      return nextWorkers;
    },
    refetchOnWindowFocus: false,
  });
}

//UPDATE hook (put users in api)
function useUpdateUsers() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (users: User[]) => {
      //send api update request here
      await new Promise((resolve) => setTimeout(resolve, 1000)); //fake api call
      return Promise.resolve();
    },
    //client side optimistic update
    onMutate: (newUsers: User[]) => {
      queryClient.setQueryData(['users'], (prevUsers: any) =>
          prevUsers?.map((user: User) => {
            const newUser = newUsers.find((u) => u.id === user.id);
            return newUser ? newUser : user;
          }),
      );
    },
    // onSettled: () => queryClient.invalidateQueries({ queryKey: ['users'] }), //refetch users after mutation, disabled for demo
  });
}

//DELETE hook (delete user in api)
function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      //send api update request here
      await new Promise((resolve) => setTimeout(resolve, 1000)); //fake api call
      return Promise.resolve();
    },
    //client side optimistic update
    onMutate: (userId: string) => {
      queryClient.setQueryData(['users'], (prevUsers: any) =>
          prevUsers?.filter((user: User) => user.id !== userId),
      );
    },
    // onSettled: () => queryClient.invalidateQueries({ queryKey: ['users'] }), //refetch users after mutation, disabled for demo
  });
}

const queryClient = new QueryClient();

const ExampleWithProviders = () => (
    //Put this with your other react-query providers near root of your app
    <MantineProvider>
        <QueryClientProvider client={queryClient}>
            <ModalsProvider>
                <Example/>
            </ModalsProvider>
        </QueryClientProvider>
    </MantineProvider>
);

export default ExampleWithProviders;

const validateRequired = (value: string) => !!value?.length;
const validateEmail = (email: string) =>
    !!email.length &&
    email
        .toLowerCase()
        .match(
            /.*?@.*?\..*?$/,
        );

function validateUser(user: User) {
  return {
    firstName: !validateRequired(user.firstName) ? 'First Name is Required' : '',
    lastName: !validateRequired(user.lastName) ? 'Last Name is Required' : '',
    email: !validateEmail(user.email) ? 'Incorrect Email Format' : '',
  };
}