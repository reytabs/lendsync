import { api } from './api';

export type Organization = {
  id: string;
  name: string;
  slug: string;
  currency: string;
  role: 'owner' | 'admin' | 'officer';
  plan_code: string | null;
  status: string;
};

type SwitchResponse = {
  access_token: string;
  token_type: string;
  user: {
    id: string;
    email: string;
    role: string;
    full_name: string;
    organization_id: string;
    org_role: string | null;
  };
};

export function listMyOrgs() {
  return api<Organization[]>('/orgs/mine');
}

export function switchOrg(organizationId: string) {
  return api<SwitchResponse>('/orgs/switch', {
    method: 'POST',
    body: JSON.stringify({ organizationId }),
  });
}
