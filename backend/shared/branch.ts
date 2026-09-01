import type { BlDocument } from "#shared/bl-document";
import type { BranchPaymentInfo } from "#shared/branch-payment-info";

export interface Branch extends BlDocument {
  name: string; // the fully qualified name of the branch e.g. Ullern Oslo VG1
  logo?: string; // the URL to the logo of the branch
  parentBranch?: string | undefined; // the ID of the parent branch for the current branch, if any e.g. Ullern Oslo
  localName?: string | undefined; // the name of this branch in relation to its parent and/or children. E.g. "VG1"
  childBranches?: string[] | undefined; // the IDs (if any) of the child branches, could for instance point to Ullern VG1 ST
  childLabel?: string | undefined; // The descriptive title of what the children represent in the hierarchy, e.g. studieprogram
  type?: string | null; // the type of branch, privatist or vgs
  openingHours?: string[]; // id of all the opening hours this branch has
  paymentInfo?: BranchPaymentInfo | undefined; // payment information for this branch
  deliveryMethods?: {
    branch?: boolean;
    byMail?: boolean;
  };
  isBranchItemsLive?: {
    // this object defines if the branchItems is live or not
    online?: boolean; // if the branchItems is live online
    atBranch?: boolean; // if the branchItems is live at branch (bladmin)
  };
  branchItems?: string[]; // ids of/or the branchItems for this branch
  location: {
    region: string;
    address?: string | undefined;
  };
}
