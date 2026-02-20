{
  description = "tspice nix development shell for linux-arm64 CSPICE source builds";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-25.05";
  };

  outputs = { nixpkgs, ... }:
    let
      mkPkgs = system: import nixpkgs { inherit system; };

      mkCspiceBuildDevShell = system:
        let
          pkgs = mkPkgs system;
          cshCompat = pkgs.writeShellScriptBin "csh" ''
            exec ${pkgs.tcsh}/bin/tcsh "$@"
          '';
        in
        pkgs.mkShell {
          packages = [
            pkgs.binutils
            cshCompat
            pkgs.file
            pkgs.gcc
            pkgs.gnumake
            pkgs.gnutar
            pkgs.ncompress
            pkgs.nodejs_22
            pkgs.ripgrep
            pkgs.tcsh
          ];

          shellHook = ''
            export TKCOMPILER=gcc
            export TKCOMPILEOPTIONS='-c -ansi -O2 -fPIC -DNON_UNIX_STDIO'
            export TKLINKOPTIONS='-lm'
          '';
        };
    in
    {
      # Intentionally exposed only for linux-arm64 (Nix system: aarch64-linux).
      devShells.aarch64-linux.default = mkCspiceBuildDevShell "aarch64-linux";
    };
}
