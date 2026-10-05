import React, { useState } from 'react';

export function StokesBridgePanel() {
  const [usuario, setUsuario] = useState('');
  const [clave, setClave] = useState('');
  const [mensaje, setMensaje] = useState('');

  const consultar = async () => {
    setMensaje('Consultando Stokes Bridge...');
    try {
      const response = await fetch('http://127.0.0.1:3847/api/reporte-stokes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usuario, password: clave, domain: 'SQM' })
      });
      const result = await response.json();
      setMensaje(response.ok ? `Registros: ${result.totalRegistros || 0}` : (result.error || 'Error'));
    } finally {
      setClave('');
    }
  };

  return <div><input value={usuario} onChange={e => setUsuario(e.target.value)} /><input type="password" value={clave} onChange={e => setClave(e.target.value)} /><button onClick={consultar}>Consultar</button><p>{mensaje}</p></div>;
}
