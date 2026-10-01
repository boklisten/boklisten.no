import type { PublicBranchNode, PublicBranchTree } from "@boklisten/backend/shared/branch";
import { Button, Skeleton } from "@mantine/core";
import { IconArrowBack, IconBasket, IconCircle, IconCircleCheckFilled } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { pathTo } from "@/features/branch-walk/branchTree";
import BranchWalkHeader from "@/features/branch-walk/BranchWalkHeader";
import walk from "@/features/branch-walk/walk.module.css";
import classes from "@/features/order/order.module.css";
import { ORDER_WALK } from "@/features/order/orderTree";
import SubjectBookFan from "@/features/order/SubjectBookFan";
import InfoAlert from "@/shared/components/alerts/InfoAlert";
import FloatingActionBar from "@/shared/components/FloatingActionBar";
import TanStackButton from "@/shared/components/TanStackButton";
import useCart from "@/shared/hooks/useCart";
import { api } from "@/shared/utils/apiClient";
import { bookCountLabel } from "@/shared/utils/bookCountLabel";

/** The end of the walk: the subjects a branch offers, picked as cards, then turned into a cart. */
export default function SubjectStep({
  tree,
  branch,
}: {
  tree: PublicBranchTree;
  branch: PublicBranchNode;
}) {
  const navigate = useNavigate();
  const cart = useCart();
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const { data: catalog } = useQuery(
    api.branchCatalog.show.queryOptions({ params: { branchId: branch.id } }),
  );
  const path = pathTo(tree, branch);
  const parent = path.at(-2);

  function toggle(subject: string) {
    setSelected((previous) => {
      const next = new Set(previous);
      if (!next.delete(subject)) {
        next.add(subject);
      }
      return next;
    });
  }

  function generateCart() {
    if (!catalog) {
      return;
    }
    cart.merge([...selected].flatMap((subject) => catalog[subject] ?? []));
    setSelected(new Set());
    void navigate({ to: "/handlekurv" });
  }

  const subjects = catalog
    ? Object.entries(catalog).toSorted(([a], [b]) => a.localeCompare(b, "nb"))
    : null;

  return (
    <>
      <BranchWalkHeader walk={ORDER_WALK} path={path} title="Velg fag" />

      {subjects === null && (
        <div className={walk.grid} aria-busy>
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} h={72} radius="lg" />
          ))}
        </div>
      )}

      {subjects?.length === 0 && (
        <div className={walk.empty}>
          <InfoAlert title="Ingen fag tilgjengelig">
            {branch.name} har ikke lagt ut noen bøker enda. Ta kontakt på info@boklisten.no om du
            har spørsmål.
          </InfoAlert>
          <TanStackButton
            to={parent ? "/bestilling/$branchId" : "/bestilling"}
            params={parent ? { branchId: parent.id } : undefined}
            variant="light"
            leftSection={<IconArrowBack size={18} />}
          >
            Velg en annen skole
          </TanStackButton>
        </div>
      )}

      {subjects && subjects.length > 0 && (
        <ul className={walk.grid}>
          {subjects.map(([subject, books]) => {
            const pressed = selected.has(subject);
            return (
              <li key={subject}>
                <button
                  type="button"
                  className={`${walk.card} ${classes.subject}`}
                  aria-pressed={pressed}
                  onClick={() => toggle(subject)}
                >
                  <SubjectBookFan books={books} />
                  <span className={walk.cardText}>
                    <span className={walk.cardName}>{subject}</span>
                    <span className={walk.cardMeta}>{bookCountLabel(books.length)}</span>
                  </span>
                  {pressed ? (
                    <IconCircleCheckFilled className={classes.check} size={24} aria-hidden />
                  ) : (
                    <IconCircle className={classes.check} size={24} stroke={1.5} aria-hidden />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <FloatingActionBar visible={selected.size > 0} summary={`${selected.size} fag valgt`}>
        <Button radius="xl" leftSection={<IconBasket />} onClick={generateCart}>
          Generer boklisten din
        </Button>
      </FloatingActionBar>
    </>
  );
}
