import type { Branch, PublicBranchNode } from "@boklisten/backend/shared/branch";
import { Button, Table } from "@mantine/core";
import { IconArrowBack, IconMapPin } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import type { Route } from "@tuyau/core/types";

import BranchWalkHeader from "@/features/branch-walk/BranchWalkHeader";
import classes from "@/features/branch-walk/walk.module.css";
import { OPENING_HOURS_WALK } from "@/features/info/openingHoursWalk";
import InfoAlert from "@/shared/components/alerts/InfoAlert";
import ContactInfo from "@/shared/components/ContactInfo";
import TanStackAnchor from "@/shared/components/TanStackAnchor";
import { api } from "@/shared/utils/apiClient";
import { formatOpeningHour } from "@/shared/utils/dates";

function OpeningHourRow({
  openingHour,
}: {
  openingHour: Route.Response<"opening_hours.index">[number];
}) {
  const { weekday, date, fromTime, toTime } = formatOpeningHour(openingHour);
  return (
    <Table.Tr key={openingHour.id}>
      <Table.Td>
        {weekday} {date}
      </Table.Td>
      <Table.Td>{fromTime}</Table.Td>
      <Table.Td>{toTime}</Table.Td>
    </Table.Tr>
  );
}

/**
 * The end of the opening-hours walk: when the stand is open at this branch, under its address.
 * A branch reached by a direct link may have no hours ahead; then the way to the other schools
 * takes the place of the table. The route loader has both queries settled before this renders.
 */
export default function BranchOpeningHours({
  branch,
  path,
}: {
  branch: Branch;
  /** The branches above this one in the walk, and the branch itself; empty off the walk. */
  path: PublicBranchNode[];
}) {
  const { data: openingHours } = useQuery(
    api.openingHours.index.queryOptions({ params: { branchId: branch.id } }),
  );

  return (
    <>
      <BranchWalkHeader walk={OPENING_HOURS_WALK} path={path} title={branch.name}>
        {branch.address && (
          <p className={classes.lead}>
            <IconMapPin size={18} aria-hidden />
            {branch.address}
          </p>
        )}
      </BranchWalkHeader>

      {openingHours && openingHours.length > 0 ? (
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Dato</Table.Th>
              <Table.Th>Fra</Table.Th>
              <Table.Th>Til</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {openingHours.map((openingHour) => (
              <OpeningHourRow key={openingHour.id} openingHour={openingHour} />
            ))}
          </Table.Tbody>
        </Table>
      ) : (
        <div className={classes.empty}>
          <InfoAlert title="Sesongen er over – eller åpningstidene er ikke klare enda">
            Du kan bestille bøker i Posten, eller kontakte oss for spørsmål.
          </InfoAlert>
          <ContactInfo />
          <Button
            component={TanStackAnchor}
            to={OPENING_HOURS_WALK.top.to}
            variant="light"
            leftSection={<IconArrowBack size={18} />}
          >
            Se andre skoler
          </Button>
        </div>
      )}
    </>
  );
}
