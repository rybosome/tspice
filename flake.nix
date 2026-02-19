{
  description = "tspice nix development shell for linux-arm64 CSPICE source builds";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-25.05";
  };

  outputs = { nixpkgs, ... }: {
    devShells.aarch64-linux.default =
      let
        pkgs = import nixpkgs { system = "aarch64-linux"; };
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
  };
}
