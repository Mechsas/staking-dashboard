// Copyright 2023 @paritytech/polkadot-staking-dashboard authors & contributors
// SPDX-License-Identifier: Apache-2.0

import Polkadot from '@ledgerhq/hw-app-polkadot';
import TransportWebHID from '@ledgerhq/hw-transport-webhid';
import React, { useRef, useState } from 'react';
import type { AnyJson } from 'types';
import { setStateWithRef } from 'Utils';
import { defaultLedgerHardwareContext } from './defaults';
import type {
  LedgerHardwareContextInterface,
  LedgerResponse,
  LedgerTask,
  PairingStatus,
} from './types';

export const TOTAL_ALLOWED_STATUS_CODES = 50;

export const LedgerHardwareContext =
  React.createContext<LedgerHardwareContextInterface>(
    defaultLedgerHardwareContext
  );

export const useLedgerHardware = () => React.useContext(LedgerHardwareContext);

export const LedgerHardwareProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  // Store whether the device has been paired.
  const [isPaired, setIsPairedState] = useState<PairingStatus>('unknown');
  const isPairedRef = useRef(isPaired);

  // Store whether an import is in process.
  const [isImporting, setIsImportingState] = useState(false);
  const isImportingRef = useRef(isImporting);

  // Store status codes received from Ledger device.
  const [statusCodes, setStatusCodes] = useState<Array<LedgerResponse>>([]);
  const statusCodesRef = useRef(statusCodes);

  // Store the latest transport error of an attempted `executeLedgerLoop`.
  const [transportError, setTransportError] = useState<LedgerResponse | null>(
    null
  );

  // Store the latest ledger device info.
  const [ledgerDeviceInfo, setLedgerDeviceInfo] = useState<AnyJson>(null);

  // Store the latest successful response from an attempted `executeLedgerLoop`.
  // TODO: migrate into an array of statuses.
  const [transportResponse, setTransportResponse] = useState<AnyJson>(null);

  // Handles errors that occur during a `executeLedgerLoop`.
  const handleErrors = (err: AnyJson) => {
    if (err?.id === 'NoDevice') {
      setTransportError({
        ack: 'failure',
        statusCode: 'DeviceNotConnected',
      });
    } else {
      setTransportError({
        ack: 'failure',
        statusCode: 'AppNotOpen',
      });
    }
  };

  // Connects to a Ledger device to check if it
  const checkPaired = async () => {
    try {
      await TransportWebHID.create();
      return true;
    } catch (e) {
      return false;
    }
  };

  // Connects to a Ledger device to perform a task.
  const executeLedgerLoop = async (
    tasks: Array<LedgerTask>,
    options?: AnyJson
  ) => {
    let transport;
    let noDevice = false;

    if (tasks.includes('get_device_info')) {
      try {
        transport = await TransportWebHID.create();
        const { deviceModel } = transport;
        if (deviceModel) {
          const { id, productName } = deviceModel;
          setLedgerDeviceInfo({
            id,
            productName,
          });
        }
        await transport.close();
      } catch (err) {
        transport = null;
        noDevice = true;
        handleErrors(err);
      }
    }

    if (!noDevice) {
      try {
        transport = await TransportWebHID.create();
        let result = null;
        if (tasks.includes('get_address')) {
          result = await handleGetAddress(transport, options.accountIndex ?? 0);
          if (result) {
            setTransportResponse({
              ack: 'success',
              options,
              ...result,
            });
          }
        }
        await transport.close();
      } catch (err) {
        transport = null;
        handleErrors(err);
      }
    }
  };

  // Gets a Polkadot address on the device.
  const handleGetAddress = async (transport: AnyJson, accountIndex: number) => {
    const polkadot = new Polkadot(transport);
    const { deviceModel } = transport;
    const { id, productName } = deviceModel;

    setTransportResponse({
      ack: 'success',
      statusCode: 'GettingAddress',
      body: `Getting addresess ${accountIndex} in progress.`,
    });

    const address = await polkadot.getAddress(
      `44'/354'/${accountIndex}'/0/0`,
      false
    );

    return {
      statusCode: 'ReceivedAddress',
      device: { id, productName },
      body: [address],
    };
  };

  // Handle an incoming new status code and persists to state.
  //
  // The most recent status code is stored at the start of the array at index 0. If total status
  // codes are larger than the maximum allowed, the status code array is popped.
  const handleNewStatusCode = (ack: string, statusCode: string) => {
    const newStatusCodes = [{ ack, statusCode }, ...statusCodes];

    // Remove last status code if there are more than allowed number of status codes.
    if (newStatusCodes.length > TOTAL_ALLOWED_STATUS_CODES) {
      newStatusCodes.pop();
    }
    setStateWithRef(newStatusCodes, setStatusCodes, statusCodesRef);
  };

  const setIsPaired = (p: PairingStatus) => {
    setStateWithRef(p, setIsPairedState, isPairedRef);
  };

  const setIsImporting = (val: boolean) => {
    setStateWithRef(val, setIsImportingState, isImportingRef);
  };

  const cancelImport = () => {
    setIsImporting(false);
    resetStatusCodes();
  };

  const resetStatusCodes = () => {
    setStateWithRef([], setStatusCodes, statusCodesRef);
  };

  const getIsImporting = () => {
    return isImportingRef.current;
  };
  return (
    <LedgerHardwareContext.Provider
      value={{
        transportError,
        ledgerDeviceInfo,
        transportResponse,
        executeLedgerLoop,
        setIsPaired,
        setIsImporting,
        cancelImport,
        checkPaired,
        handleNewStatusCode,
        resetStatusCodes,
        getIsImporting,
        statusCodes: statusCodesRef.current,
        isPaired: isPairedRef.current,
      }}
    >
      {children}
    </LedgerHardwareContext.Provider>
  );
};
