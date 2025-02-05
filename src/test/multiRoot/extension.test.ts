import * as assert from "assert";

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from "vscode";
import * as path from "path";
import { ElixirLS } from "../../extension";
import { WorkspaceMode } from "../../project";
import {
  getExtension,
  sleep,
  waitForLanguageClientManagerUpdate,
  waitForWorkspaceUpdate,
} from "../utils";

let extension: vscode.Extension<ElixirLS>;
const fixturesPath = path.resolve(__dirname, "../../../src/test-fixtures");

suite("Multi root workspace tests", () => {
  vscode.window.showInformationMessage("Start multi root workspace tests.");

  suiteSetup(async () => {
    extension = getExtension();
  });

  test("extension detects mix.exs and actives", async () => {
    assert.ok(extension.isActive);
    assert.equal(
      extension.exports.workspaceTracker.mode,
      WorkspaceMode.MULTI_ROOT
    );
    assert.ok(!extension.exports.languageClientManager.defaultClient);
    assert.equal(extension.exports.languageClientManager.clients.size, 0);
  }).timeout(30000);

  test("extension starts first client on file open", async () => {
    const fileUri = vscode.Uri.file(
      path.join(fixturesPath, "sample_umbrella", "mix.exs")
    );

    await waitForLanguageClientManagerUpdate(extension, async () => {
      const document = await vscode.workspace.openTextDocument(fileUri);
      await vscode.window.showTextDocument(document);
    });

    assert.ok(!extension.exports.languageClientManager.defaultClient);
    assert.equal(extension.exports.languageClientManager.clients.size, 1);
  }).timeout(30000);

  test("requests from workspace file: docs go to outermost folder client", async () => {
    const parentWorkspaceUri = vscode.Uri.file(
      path.join(fixturesPath, "sample_umbrella")
    );
    const fileUri = vscode.Uri.file(
      path.join(fixturesPath, "sample_umbrella", "mix.exs")
    );
    assert.equal(
      extension.exports.languageClientManager.getClientByUri(fileUri),
      extension.exports.languageClientManager.clients.get(
        parentWorkspaceUri.toString()
      )
    );
  });

  test("extension does not start client for nested workspace", async () => {
    const fileUri = vscode.Uri.file(
      path.join(fixturesPath, "sample_umbrella", "apps", "child1", "mix.exs")
    );
    const document = await vscode.workspace.openTextDocument(fileUri);
    await vscode.window.showTextDocument(document);

    await sleep(3000);

    assert.ok(!extension.exports.languageClientManager.defaultClient);
    assert.equal(extension.exports.languageClientManager.clients.size, 1);
  }).timeout(30000);

  test("requests from nested workspace file: docs go to outermost folder client", async () => {
    const parentWorkspaceUri = vscode.Uri.file(
      path.join(fixturesPath, "sample_umbrella")
    );
    const fileUri = vscode.Uri.file(
      path.join(fixturesPath, "sample_umbrella", "apps", "child1", "mix.exs")
    );
    assert.equal(
      extension.exports.languageClientManager.getClientByUri(fileUri),
      extension.exports.languageClientManager.clients.get(
        parentWorkspaceUri.toString()
      )
    );
  });

  test("requests from untitled: docs go to first workspace client", async () => {
    const sampleFileUri = vscode.Uri.parse("untitled:sample.exs");
    assert.equal(
      extension.exports.languageClientManager.getClientByUri(sampleFileUri),
      extension.exports.languageClientManager.clients.get(
        vscode.workspace.workspaceFolders![0].uri.toString()
      )
    );
  });

  // TODO throw or return null
  // test("requests from non workspace file: docs go to first workspace client", async () => {
  //   const fileUri = vscode.Uri.file(path.join(fixturesPath, "elixir_file.ex"));
  //   assert.equal(
  //     languageClientManager.getClientByUri(fileUri),
  //     languageClientManager.clients.get(vscode.workspace.workspaceFolders![0].uri.toString())
  //   );
  // });

  test("extension starts second client on file open from different outermost folder", async () => {
    const fileUri = vscode.Uri.file(
      path.join(fixturesPath, "single_folder_no_mix", "elixir_script.exs")
    );

    await waitForLanguageClientManagerUpdate(extension, async () => {
      const document = await vscode.workspace.openTextDocument(fileUri);
      await vscode.window.showTextDocument(document);
    });

    assert.ok(!extension.exports.languageClientManager.defaultClient);
    assert.equal(extension.exports.languageClientManager.clients.size, 2);
  }).timeout(30000);

  test("extension reacts to added and removed workspace folder", async () => {
    const addedFolderUri = vscode.Uri.file(
      path.join(fixturesPath, "single_folder_mix")
    );
    await waitForWorkspaceUpdate(() => {
      vscode.workspace.updateWorkspaceFolders(
        vscode.workspace.workspaceFolders!.length,
        null,
        {
          uri: addedFolderUri,
          name: "single_folder_mix",
        }
      );
    });

    const fileUri = vscode.Uri.file(
      path.join(fixturesPath, "single_folder_mix", "mix.exs")
    );

    await waitForLanguageClientManagerUpdate(extension, async () => {
      const document = await vscode.workspace.openTextDocument(fileUri);
      await vscode.window.showTextDocument(document);
    });

    assert.ok(!extension.exports.languageClientManager.defaultClient);
    assert.equal(extension.exports.languageClientManager.clients.size, 3);

    const addedWorkspaceFolder =
      vscode.workspace.getWorkspaceFolder(addedFolderUri)!;

    await waitForLanguageClientManagerUpdate(extension, async () => {
      vscode.workspace.updateWorkspaceFolders(addedWorkspaceFolder.index, 1);
    });

    assert.equal(extension.exports.languageClientManager.clients.size, 2);
  }).timeout(30000);

  test("extension does not react to added and removed nested workspace folder", async () => {
    const addedFolderUri = vscode.Uri.file(
      path.join(fixturesPath, "sample_umbrella", "apps", "child2")
    );
    await waitForWorkspaceUpdate(() => {
      vscode.workspace.updateWorkspaceFolders(
        vscode.workspace.workspaceFolders!.length,
        null,
        {
          uri: addedFolderUri,
          name: "single_folder_mix",
        }
      );
    });

    const fileUri = vscode.Uri.file(
      path.join(fixturesPath, "sample_umbrella", "apps", "child2", "mix.exs")
    );
    const document = await vscode.workspace.openTextDocument(fileUri);
    await vscode.window.showTextDocument(document);

    await sleep(3000);

    assert.ok(!extension.exports.languageClientManager.defaultClient);
    assert.equal(extension.exports.languageClientManager.clients.size, 2);

    const addedWorkspaceFolder =
      vscode.workspace.getWorkspaceFolder(addedFolderUri)!;

    await waitForWorkspaceUpdate(() => {
      vscode.workspace.updateWorkspaceFolders(addedWorkspaceFolder.index, 1);
    });

    await sleep(3000);

    assert.equal(extension.exports.languageClientManager.clients.size, 2);
  }).timeout(30000);
});
