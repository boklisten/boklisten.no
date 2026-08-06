import { Button, Box } from "@mantine/core";
import { modals } from "@mantine/modals";
import { AG_GRID_LOCALE_NO } from "@ag-grid-community/locale";
import type { ICellRendererParams } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { Route } from "@tuyau/core/types";

import MoveBranchMemberModal from "@/features/branches/MoveBranchMemberModal";

type BranchMember = Route.Response<"branch_membership.get_members">["directMembers"][number];

export default function BranchMembersTable({
  branchId,
  members,
  isLoading,
}: {
  branchId: string;
  members: BranchMember[];
  isLoading: boolean;
}) {
  return (
    <Box h={500}>
      <AgGridReact<BranchMember>
        rowData={members}
        columnDefs={[
          { field: "name", headerName: "Navn" },
          { field: "yearOfBirth", headerName: "Fødselsår" },
          {
            headerName: "Handlinger",
            pinned: "right",
            width: 110,
            sortable: false,
            filter: false,
            resizable: false,
            cellRenderer: ({ data }: ICellRendererParams<BranchMember>) =>
              data && (
                <Button
                  variant={"subtle"}
                  onClick={() => {
                    const modalId = modals.open({
                      title: `Flytt ${data.name}`,
                      children: (
                        <MoveBranchMemberModal
                          branchId={branchId}
                          memberId={data.id}
                          onClose={() => modals.close(modalId)}
                        />
                      ),
                    });
                  }}
                >
                  Flytt
                </Button>
              ),
          },
        ]}
        defaultColDef={{ flex: 1, sortable: true, filter: true }}
        getRowId={({ data }) => data.id}
        localeText={AG_GRID_LOCALE_NO}
        loading={isLoading}
        pagination
        paginationPageSize={20}
      />
    </Box>
  );
}
