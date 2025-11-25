import React from 'react';
import { useParams } from 'react-router-dom';
import SdrAdminPanel from '../components/sdr/SdrAdminPanel';

export default function SdrAdminPage() {
  const { operationId } = useParams();
  return <SdrAdminPanel operationId={operationId} />;
}
