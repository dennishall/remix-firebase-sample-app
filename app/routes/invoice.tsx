import { json } from "@remix-run/node";
import {db} from '../firebase-service';
import { collection, doc, getDocs, addDoc, updateDoc } from "firebase/firestore";
import adminApp from '../lib/firebase.admin.server';

import mantineCoreStyles from '@mantine/core/styles.css';
import mantineTableStyles from 'mantine-react-table/styles.css'; //make sure MRT styles were imported in your app root (once)
// import '@mantine/dates/styles.css'; //if using mantine date picker features
import mainStyles from '../styles/main.css';
import {useMemo, useState} from 'react';
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
import { type User, usStates } from '../utils/makeData';
import anyTrue from '../utils/anyTrue';

import { isSessionValid } from "~/fb.sessions.server";
import {useLoaderData} from "@remix-run/react";

export const links = () => {
    return [
        { rel: "stylesheet", href: mantineCoreStyles },
        { rel: "stylesheet", href: mantineTableStyles },
        { rel: "stylesheet", href: mainStyles },
    ];
};

// use loader to check for existing session
// loader is server-side only
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

// action is server-side only
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

            const workerData = fieldNames.split(',').reduce((result, fieldName) => ({
                ...result,
                [fieldName]: (formData.get(fieldName) || '').trim(),
            }), {});

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

            // TODO - implementation (updateUser() is not defined)
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
  // keep track of rows that have been edited
  const [editedUsers, setEditedUsers] = useState<Record<string, User>>({});

  // call CREATE hook
  const { mutateAsync: createUser, isPending: isCreatingUser } =
      useCreateUser();
  // call READ hook
  const {
    data: fetchedUsers = [],
    isError: isLoadingUsersError,
    isFetching: isFetchingUsers,
    isLoading: isLoadingUsers,
  } = useGetUsers();
  // call UPDATE hook
  const { mutateAsync: updateUsers, isPending: isUpdatingUser } =
      useUpdateUsers();
  // call DELETE hook
  const { mutateAsync: deleteUser, isPending: isDeletingUser } =
      useDeleteUser();

  // CREATE action
  const handleCreateUser: MRT_TableOptions<User>['onCreatingRowSave'] = async ({
    values,
    exitCreatingMode,
  }) => {
    const newValidationErrors = validateUser(values);
    if (Object.values(newValidationErrors).some((error) => !!error)) {
      setValidationErrors(newValidationErrors);
      return;
    }
    // instead of using our own uuid, we will use the document id returned by firebase firestore.
    // values.id = uuid();
    setValidationErrors({});
    await createUser(values);
    exitCreatingMode();
  };

  // UPDATE action
  const handleSaveUsers = async () => {
    if (Object.values(validationErrors).some((error) => !!error)) return;
    await updateUsers(Object.values(editedUsers));
    setEditedUsers({});
  };

  // DELETE action
  const openDeleteConfirmModal = (row: MRT_Row<User>) =>
      modals.openConfirmModal({
        title: 'Are you sure you want to delete this user?',
        children: (
            <Text>
              Are you sure you want to delete {row.original.firstName}{' '}
              {row.original.lastName}? (This can be undone later if needed.)
            </Text>
        ),
        labels: { confirm: 'Delete', cancel: 'Cancel' },
        confirmProps: { color: 'red' },
        onConfirm: () => deleteUser(row.original.id),
      });

  const columns = useMemo<MRT_ColumnDef<User>[]>(
      () => [
        // {
        //   accessorKey: 'id',
        //   header: 'Id',
        //   enableEditing: false,
        //   size: 50,
        // },
        {
          accessorKey: 'firstName',
          header: 'First Name',
          mantineEditTextInputProps: ({ cell, row }) => ({
            type: 'text',
            required: true,
            error: validationErrors?.[cell.id],
            // store edited user in state to be saved later
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
            // store edited user in state to be saved later
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
          accessorKey: 'hourlyRate',
          header: 'Hourly Rate',
          mantineEditTextInputProps: ({ cell, row }) => ({
              type: 'number',
              required: false,
              error: validationErrors?.[cell.id],
              // store edited user in state to be saved later
              onChange: (event) => {
                // const validationError = !validateRequired(event.currentTarget.value)
                //   ? 'Required'
                //   : undefined;
                // setValidationErrors({
                //   ...validationErrors,
                //   [cell.id]: validationError,
                // });
                console.log('hourly rate changed', row.original, event.target.value);
                // TODO !!! -- keep an array of hourly rates with timestamps.
                  // ... or .. keep full records of every change to the user with timestamps.
                setEditedUsers({
                    ...editedUsers,
                    [row.id]: {...row.original, hourlyRate: +event.target.value },
                });
              },
          }),
        },
        {
          accessorKey: 'state',
          header: 'State',
          editVariant: 'select',
          mantineEditSelectProps: ({ row }) => ({
            data: usStates,
            // store edited user in state to be saved later
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


  return (
      <>
          <MantineReactTable table={table} />
          <div className="ui segment">
              <div className="ui medium header">Querying Firestore Database</div>
              {(data.responseData || []).map((m, i) => (
                  <div className="ui segment" key={i}>
                      <pre>{JSON.stringify(m, null, 4)}</pre>
                  </div>
              ))}
          </div>
      </>
  );
};

// CREATE hook (post new user to api)
function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (user: User) => {
      // send api update request here
      const docRef = await addDoc(collection(db, 'workers'), user);
      // set local copy of user id to id returned by addDoc.
      user.id = docRef.id;
      console.log('create user :: id from firebase', user.id);
      return new Promise(resolve => resolve());
      // await new Promise((resolve) => setTimeout(resolve, 1000)); //fake api call
      // return Promise.resolve();
    },
    // client-side optimistic update
    onMutate: (newUserInfo: User) => {
        console.log({newUserInfo});
      queryClient.setQueryData(
          ['users'],
          (prevUsers: any) =>
              [
                ...prevUsers,
                {
                  ...newUserInfo,
                },
              ] as User[],
    );
    },
    // refetch users after mutation, disabled for demo
    // onSettled: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });
}

// READ hook (get users from api)
function useGetUsers() {
  return useQuery<User[]>({
    queryKey: ['users'],
    queryFn: async () => {
      // send api request here
      // await new Promise((resolve) => setTimeout(resolve, 1000)); //fake api call
      // return Promise.resolve(fakeData);
      const q = await getDocs(collection(db, 'workers'));
      console.log(q);
      const nextWorkers = [];
      q.forEach(item => {
          const userData = item.data();
          // filter by NOT 'isDeleted', implementing SOFT DELETE
          if (!userData.isDeleted) {
              nextWorkers.push({...userData, id: item.id});
          }
      });
      return nextWorkers;
    },
    refetchOnWindowFocus: false,
  });
}

// UPDATE hook (put users in api)
function useUpdateUsers() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (updatedUsers: User[]) => {
      // send api update request here
      // await new Promise((resolve) => setTimeout(resolve, 1000)); // fake api call
      // return Promise.resolve();
      return Promise.all(updatedUsers.map(updatedUser => {
        console.log('updateDoc', updatedUser.id, updatedUser.hourlyRate);
        return updateDoc(doc(db, 'workers', updatedUser.id), updatedUser);
      }));
    },
    // client-side optimistic update
    onMutate: (updatedUsers: User[]) => {
      queryClient.setQueryData(['users'], (prevUsers: any) =>
          prevUsers?.map((user: User) => {
            // does this user from the prevUsers match any of the ones that were updated?
            // i.e., is this an updated user?
            const updatedUser = updatedUsers.find((u) => u.id === user.id);
            // if so, return the updated version instead of the old version (else, return old version)
            if (updatedUser) {
              console.log('updated user', updatedUser.hourlyRate, updatedUser);
            }
            return updatedUser ? updatedUser : user;
          }),
      );
    },
    // refetch users after mutation, disabled for demo
    // onSettled: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });
}

// DELETE hook (delete user in api)
function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      // send api update request here
      // await new Promise((resolve) => setTimeout(resolve, 1000)); //fake api call
      // return Promise.resolve();
      // don't actually delete .. just mark as deleted.
      // return deleteDoc(doc(db, 'workers', userId));
      return updateDoc(doc(db, 'workers', userId), {isDeleted: true});
    },
    // client-side optimistic update
    onMutate: (userId: string) => {
      queryClient.setQueryData(['users'], (prevUsers: any) =>
        prevUsers?.filter((user: User) => user.id !== userId),
      );
    },
    // refetch users after mutation, disabled for demo
    // onSettled: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });
}

const queryClient = new QueryClient();

const ExampleWithProviders = () => (
  // Put this with your other react-query providers near root of your app
  <MantineProvider>
    <QueryClientProvider client={queryClient}>
      <ModalsProvider>
        <Example/>
      </ModalsProvider>
    </QueryClientProvider>
  </MantineProvider>
);

export default ExampleWithProviders;

const validateRequired = (value: string) => (value || '').trim().length > 0;
const validateEmail = (email: string) => /.+@.+[.].+$/.test(email);

function validateUser(user: User) {
  return {
    firstName: !validateRequired(user.firstName) ? 'First Name is Required' : '',
    lastName: !validateRequired(user.lastName) ? 'Last Name is Required' : '',
    email: !validateEmail(user.email) ? 'Incorrect Email Format' : '',
  };
}