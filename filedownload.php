<?php
/*
   File Download Counter
   Version 1.0
   August 25, 2019

   Will Bontrager Software LLC
   https://www.willmaster.com/
*/

/////////////////////////////////////////
// Customizations (3 places to customize)

// Place 1:
// Specify the location of the downloadable file 
//    (location relative to the document root directory).

$LocationOfDownloadableFile = "/download/downloads/OP_Piglin_Barter.mcpack";


// Place 2:
// Specify "yes" or "no" to force download. If "no" 
//    (or blank or anything other than "yes") the 
//    browser will decide whether to download or 
//    load into current browser window.)

$ForceFileDownload = "yes";


// Place 3:
// Specify the location of the log file in a subdirectory. 
//    The directory must be writable, which might require 
//    777 permissions, depending on how PHP is configured.

$LocationOfLogFile = "/download/log.txt";

// End of customization section
/////////////////////////////////////////

file_put_contents("{$_SERVER['DOCUMENT_ROOT']}$LocationOfLogFile",date('r')."\t".$_SERVER['REMOTE_ADDR']."\t$LocationOfDownloadableFile\t".$_SERVER['HTTP_USER_AGENT']."\n",FILE_APPEND);
if( trim(strtolower($ForceFileDownload)) == 'yes' )
{
    $filename = array_pop( explode('/',$LocationOfDownloadableFile) );
    header('Content-Type:application/octet-stream');
    header("Content-Disposition:attachment; filename=\"$filename\"");
    readfile("{$_SERVER['DOCUMENT_ROOT']}$LocationOfDownloadableFile");
}
else { header("Location: $LocationOfDownloadableFile"); }
exit;
?>
