import React, { useRef } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { TextureLoader } from 'three';

export default function Earth() {
  const meshRef = useRef();
  
  // Load Earth texture - using NASA Blue Marble texture URL
  const earthTexture = useLoader(
    TextureLoader,
    'https://unpkg.com/three-globe@2.31.1/example/img/earth-blue-marble.jpg'
  );

  // Rotate Earth at real-time speed (one full rotation = 24 hours)
  useFrame((state, delta) => {
    if (meshRef.current) {
      // Earth rotates 360 degrees in 24 hours = 0.004167 degrees per second
      // Convert to radians: 0.004167 * (PI/180) = 0.0000727 radians per second
      meshRef.current.rotation.y += delta * 0.0000727; // Real-time rotation
    }
  });

  return (
    <mesh ref={meshRef} position={[0, 0, 0]}>
      <sphereGeometry args={[6.371, 64, 64]} /> {/* Earth radius = 6371 km */}
      <meshStandardMaterial 
        map={earthTexture}
        roughness={0.8}
        metalness={0.2}
      />
    </mesh>
  );
}
