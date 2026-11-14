KPL/FK

Project-authored test frame and camera for the existing synthetic attitude CK.
The camera looks along its frame's +X axis. A circular cone with a small
angular radius resolves the changing orientation between CK records.

\begindata
FRAME_AUDIT_GF_CAMERA         = -123000
FRAME_-123000_NAME            = 'AUDIT_GF_CAMERA'
FRAME_-123000_CLASS           = 3
FRAME_-123000_CLASS_ID        = -123000
FRAME_-123000_CENTER          = 100103
CK_-123000_SCLK               = -123
CK_-123000_SPK                = 100103
NAIF_BODY_NAME                += ( 'AUDIT_GF_CAMERA' )
NAIF_BODY_CODE                += ( -123000 )
INS-123000_FOV_SHAPE          = 'CIRCLE'
INS-123000_FOV_FRAME          = 'AUDIT_GF_CAMERA'
INS-123000_BORESIGHT          = ( 1 0 0 )
INS-123000_FOV_BOUNDARY_CORNERS = ( 1 0.005 0 )
\begintext
