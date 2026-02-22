{
  description = "tspice nix development + hermetic linux-arm64 CSPICE builds";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-25.05";
  };

  outputs = { self, nixpkgs, ... }:
    let
      cspiceManifest = builtins.fromJSON (builtins.readFile ./scripts/cspice.manifest.json);

      mkPkgs = system: import nixpkgs { inherit system; };

      mkCspiceBuildTools = pkgs:
        let
          cshCompat = pkgs.writeShellScriptBin "csh" ''
            exec ${pkgs.tcsh}/bin/tcsh "$@"
          '';
        in
        [
          pkgs.binutils
          cshCompat
          pkgs.file
          pkgs.gcc
          pkgs.gnumake
          pkgs.gnutar
          pkgs.ncompress
          pkgs.tcsh
        ];

      cspiceBuildEnvExports = ''
        export TKCOMPILER=gcc
        export TKCOMPILEOPTIONS='-c -ansi -O2 -fPIC -DNON_UNIX_STDIO'
        export TKLINKOPTIONS='-lm'

        # Keep archive/object timestamps deterministic where supported.
        export SOURCE_DATE_EPOCH=1
        export ZERO_AR_DATE=1
      '';

      mkCspiceSourceTarball = pkgs:
        pkgs.fetchurl {
          url = cspiceManifest.source.url;
          hash = builtins.convertHash {
            hash = cspiceManifest.source.sha256;
            hashAlgo = "sha256";
            toHashFormat = "sri";
          };
        };

      mkCspiceBuildDerivation = system:
        let
          pkgs = mkPkgs system;
        in
        pkgs.stdenv.mkDerivation rec {
          pname = "tspice-cspice-linux-arm64";
          version = cspiceManifest.toolkitVersion;

          src = mkCspiceSourceTarball pkgs;

          strictDeps = true;
          dontConfigure = true;
          doCheck = true;

          nativeBuildInputs = mkCspiceBuildTools pkgs;

          unpackPhase = ''
            runHook preUnpack
            tar --auto-compress -xf "$src"
            runHook postUnpack
          '';

          buildPhase = ''
            runHook preBuild
            ${cspiceBuildEnvExports}

            ( cd cspice/src/cspice && tcsh ./mkprodct.csh )
            ( cd cspice/src/csupport && tcsh ./mkprodct.csh )

            runHook postBuild
          '';

          checkPhase = ''
            runHook preCheck

            test -f cspice/lib/cspice.a
            test -f cspice/lib/csupport.a
            test -f cspice/include/SpiceUsr.h
            test -f cspice/include/SpiceZfc.h
            test -f cspice/include/SpiceZmc.h

            tmpdir="$(mktemp -d)"
            trap 'rm -rf "$tmpdir"' EXIT

            for archive in cspice/lib/cspice.a cspice/lib/csupport.a; do
              members="$(ar t "$archive")"
              test -n "$members"

              while IFS= read -r member; do
                test -n "$member"

                objFile="$(mktemp "$tmpdir/obj.XXXXXX")"
                ar p "$archive" "$member" > "$objFile"

                if ! file "$objFile" | grep -E 'ARM aarch64|AArch64' >/dev/null; then
                  echo "Expected AArch64 object in $archive member $member"
                  file "$objFile"
                  exit 1
                fi
              done <<< "$members"
            done

            runHook postCheck
          '';

          installPhase = ''
            runHook preInstall
            mkdir -p "$out/include" "$out/lib"
            cp -a cspice/include/. "$out/include/"
            cp -a cspice/lib/cspice.a cspice/lib/csupport.a "$out/lib/"
            runHook postInstall
          '';

          meta = with pkgs.lib; {
            description = "Hermetic linux-arm64 CSPICE static libraries for tspice";
            platforms = [ "aarch64-linux" ];
          };
        };

      mkCspiceBuildDevShell = system:
        let
          pkgs = mkPkgs system;
        in
        pkgs.mkShell {
          packages = (mkCspiceBuildTools pkgs) ++ [ pkgs.nodejs_22 pkgs.ripgrep ];
          shellHook = cspiceBuildEnvExports;
        };
    in
    {
      # Intentionally exposed only for linux-arm64 (Nix system: aarch64-linux).
      devShells.aarch64-linux.default = mkCspiceBuildDevShell "aarch64-linux";

      packages.aarch64-linux.cspice-linux-arm64 = mkCspiceBuildDerivation "aarch64-linux";
      packages.aarch64-linux.default = self.packages.aarch64-linux.cspice-linux-arm64;

      checks.aarch64-linux.cspice-linux-arm64 = self.packages.aarch64-linux.cspice-linux-arm64;
    };
}
