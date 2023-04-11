// Copyright 2023 @paritytech/polkadot-staking-dashboard authors & contributors
// SPDX-License-Identifier: Apache-2.0

export interface PoolAccountProps {
  address: string | null;
  last?: boolean;
  batchKey: string;
  batchIndex: number;
}

export interface PayoutListContextInterface {
  setListFormat: (v: string) => void;
  listFormat: string;
}
